/**
 * Max-coverage PTAC capture: seek as far back as the broker retains, drain
 * until we catch up to the head, then dedupe by Darwin RID. Reports how
 * deep we got and how many distinct services were cached.
 *
 * Use this to size expectations before committing to daemon code; the
 * daemon's strategy will be the same (max replay + persist).
 */
import { Kafka, logLevel } from 'kafkajs';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const REPLAY_MIN = Number(process.env.REPLAY_MIN || 720);   // ask for 12h
const MAX_SEC    = Number(process.env.MAX_SEC    || 90);    // hard cap so we exit
const QUIET_SEC  = Number(process.env.QUIET_SEC  || 6);     // exit early when silent

// ---------- Build Darwin headcode index ---------------------------------
const ttDir   = resolve(__dirname, '../docs/V8s');
const todayY  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const ttFile  = readdirSync(ttDir).find((f) => f.startsWith(`PPTimetable_${todayY}`) && f.endsWith('.xml.gz'));
console.log(`[max] indexing ${ttFile}`);
const xmlBuf = gunzipSync(readFileSync(resolve(ttDir, ttFile))).toString('utf8');
const headcodeIndex = new Map();
const jrgx = /<(?:ns2:)?Journey\b([^>]*?)>([\s\S]*?)<\/(?:ns2:)?Journey>/g;
let jm; let journeys = 0;
while ((jm = jrgx.exec(xmlBuf))) {
  journeys++;
  const a = jm[1], b = jm[2];
  const rid     = a.match(/\brid="([^"]+)"/)?.[1];
  const trainId = a.match(/\btrainId="([^"]+)"/)?.[1];
  const ssd     = a.match(/\bssd="([^"]+)"/)?.[1];
  if (!rid || !trainId || !ssd) continue;
  const orm = b.match(/<(?:ns2:)?(?:OR|OPOR)\b([^>]*?)\/?>/);
  if (!orm) continue;
  const oa  = orm[1];
  const tpl = oa.match(/\btpl="([^"]+)"/)?.[1];
  const ot  = (oa.match(/\bptd="([^"]+)"/)?.[1] || oa.match(/\bwtd="([^"]+)"/)?.[1] || '').slice(0, 5);
  if (!tpl) continue;
  const k = `${ssd}|${trainId}`;
  let arr = headcodeIndex.get(k);
  if (!arr) { arr = []; headcodeIndex.set(k, arr); }
  arr.push({ rid, originTiploc: tpl, originTime: ot });
}
console.log(`[max] ${journeys} journeys; ${headcodeIndex.size} (ssd|headcode) keys.`);

// ---------- Kafka ---------------------------------------------------------
const kafka = new Kafka({
  clientId: 'rs-ptac-max', brokers: [process.env.PTAC_BOOTSTRAP], ssl: true,
  sasl: { mechanism: 'plain', username: process.env.PTAC_USERNAME, password: process.env.PTAC_PASSWORD },
  logLevel: logLevel.ERROR,
});
const consumer = kafka.consumer({ groupId: process.env.PTAC_GROUP_ID, sessionTimeout: 10000 });
await consumer.connect();
await consumer.subscribe({ topic: process.env.PTAC_TOPIC, fromBeginning: false });

const admin = kafka.admin(); await admin.connect();
let replayOffsets = null;
let earliestOffsets = null;
try {
  replayOffsets   = await admin.fetchTopicOffsetsByTimestamp(process.env.PTAC_TOPIC, Date.now() - REPLAY_MIN * 60_000);
  earliestOffsets = await admin.fetchTopicOffsets(process.env.PTAC_TOPIC);
} catch (e) { console.warn('offset lookup error:', e.message); }
finally { await admin.disconnect(); }
console.log(`[max] requested replay -${REPLAY_MIN}m → offsets:`, replayOffsets);

const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false, parseTagValue: false,
  trimValues: true, isArray: (n) => ['Allocation','Vehicle','Defect','ResourceGroup','TransportOperationalIdentifiers'].includes(n),
});
const txt = (n) => (n == null ? null : typeof n === 'object' ? (n['#text'] ?? null) : String(n));

let consumed = 0;
let withAlloc = 0;
let matched = 0;
let lastSeen = Date.now();
const consistByRid = new Map();
const tocCount = new Map();        // PTAC numeric TOC -> matched count
const fleetCount = new Map();
const earliestMessageTs = { ts: null };
const latestMessageTs   = { ts: null };

await consumer.run({
  eachMessage: async ({ message }) => {
    consumed++; lastSeen = Date.now();
    const tsMs = Number(message.timestamp);
    if (!earliestMessageTs.ts || tsMs < earliestMessageTs.ts) earliestMessageTs.ts = tsMs;
    if (!latestMessageTs.ts   || tsMs > latestMessageTs.ts)   latestMessageTs.ts = tsMs;

    const raw = message.value.toString('utf8');
    const x = raw.indexOf('<?xml'); const stripped = x >= 0 ? raw.slice(x) : raw;
    let doc; try { doc = parser.parse(stripped); } catch { return; }
    const m = doc.PassengerTrainConsistMessage; if (!m) return;
    const allocs = m.Allocation || []; if (!allocs.length) return;
    withAlloc++;

    const tiList = m.TrainOperationalIdentification?.TransportOperationalIdentifiers || [];
    const ti = tiList.find((t) => String(t.Company) !== '0070') || tiList[0] || {};
    const headcode = m.OperationalTrainNumberIdentifier?.OperationalTrainNumber;
    const ssd = ti.StartDate;
    if (!headcode || !ssd) return;

    const a0 = allocs[0];
    const originTpl = txt(a0?.TrainOriginLocation?.LocationSubsidiaryIdentification?.LocationSubsidiaryCode);
    const originHHMM = a0?.TrainOriginDateTime?.slice(11, 16);

    const cands = headcodeIndex.get(`${ssd}|${headcode}`) || [];
    let pick = cands.find((c) => c.originTiploc === originTpl && c.originTime === originHHMM)
            || cands.find((c) => c.originTiploc === originTpl)
            || (cands.length === 1 ? cands[0] : null);
    if (!pick) return;
    matched++;

    // Latest broadcast wins (overwrites any earlier consist).
    const groups = [];
    const seenUnits = new Set();
    for (const a of allocs) {
      const pos = Number(a.ResourceGroupPosition) || 0;
      for (const rg of (a.ResourceGroup || [])) {
        if (!rg.ResourceGroupId || seenUnits.has(rg.ResourceGroupId)) continue;
        seenUnits.add(rg.ResourceGroupId);
        groups.push({
          position: pos, unit: rg.ResourceGroupId, fleet: rg.FleetId, reversed: a.Reversed === 'Y',
          vehicles: (rg.Vehicle || []).map((v) => ({
            id: v.VehicleId, type: v.SpecificType, seats: Number(v.NumberOfSeats) || null,
            speed: Number(v.MaximumSpeed) || null, defects: (v.Defect || []).length,
          })),
        });
        fleetCount.set(rg.FleetId, (fleetCount.get(rg.FleetId) || 0) + 1);
      }
    }
    consistByRid.set(pick.rid, { groups, ptacCompany: ti.Company });
    tocCount.set(ti.Company, (tocCount.get(ti.Company) || 0) + 1);
  },
});

if (replayOffsets) {
  await new Promise((r) => setTimeout(r, 1500));
  for (const o of replayOffsets) {
    try { consumer.seek({ topic: process.env.PTAC_TOPIC, partition: o.partition, offset: o.offset }); }
    catch (e) { console.warn(`seek p${o.partition}: ${e.message}`); }
  }
}

const startedAt = Date.now();
const tick = setInterval(() => {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  process.stdout.write(`\r[max] t=${elapsed}s  consumed=${consumed}  with-alloc=${withAlloc}  matched=${matched}  unique=${consistByRid.size}   `);
  if (Date.now() - lastSeen > QUIET_SEC * 1000 || elapsed > MAX_SEC) {
    clearInterval(tick);
    finish();
  }
}, 500);

async function finish() {
  console.log(`\n\n[max] DONE`);
  console.log(`  consumed:           ${consumed}`);
  console.log(`  with allocations:   ${withAlloc}`);
  console.log(`  matched to RIDs:    ${matched}`);
  console.log(`  unique services:    ${consistByRid.size}`);
  console.log(`  earliest msg:       ${earliestMessageTs.ts ? new Date(earliestMessageTs.ts).toISOString() : 'n/a'}`);
  console.log(`  latest msg:         ${latestMessageTs.ts   ? new Date(latestMessageTs.ts).toISOString()   : 'n/a'}`);
  if (earliestMessageTs.ts && latestMessageTs.ts) {
    const span = (latestMessageTs.ts - earliestMessageTs.ts) / 60_000;
    console.log(`  effective span:     ${span.toFixed(1)} min  (broker retention)`);
  }

  console.log('\nTop fleets by message count:');
  const fleets = [...fleetCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [f, n] of fleets) console.log(`  ${f.padEnd(8)}  ${n}`);

  console.log('\nPTAC TOC numeric codes:');
  const tocs = [...tocCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [t, n] of tocs) console.log(`  ${t}: ${n} services`);

  await consumer.disconnect();
  process.exit(0);
}
