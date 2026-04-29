/**
 * Demo: list all Leeds departures (Darwin) with their physical consist
 * (PTAC). Captures PTAC messages for RUN_SEC, joins by (ssd, headcode,
 * originTiploc, originTime), then renders the LDS board.
 *
 * Run: RUN_SEC=30 REPLAY_MIN=120 node darwin-local-test/demo-leeds-with-consist.mjs
 *
 * REPLAY_MIN defaults to 60 to maximise broker-retention coverage. Run with
 * the daemon already running (Vite + departures-daemon) so the LDS board API
 * is live; this script only adds the consist join, it doesn't touch Darwin's
 * own consumer group.
 */
import { Kafka, logLevel } from 'kafkajs';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { request as httpRequest } from 'node:http';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const RUN_SEC    = Number(process.env.RUN_SEC    || 30);
const REPLAY_MIN = Number(process.env.REPLAY_MIN || 60);
const STATION    = process.env.STATION || 'LDS';

// ---------- Helpers -------------------------------------------------------
function getJSON(path) {
  return new Promise((res, rej) => {
    const r = httpRequest({ host: 'localhost', port: 4001, path, method: 'GET', timeout: 5000 }, (resp) => {
      let buf = ''; resp.on('data', (c) => buf += c);
      resp.on('end', () => { try { res(JSON.parse(buf)); } catch (e) { rej(e); } });
    });
    r.on('error', rej); r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); }); r.end();
  });
}

// ---------- 1. Build Darwin headcode index from timetable ----------------
const ttDir   = resolve(__dirname, '../docs/V8s');
const todayY  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const ttFile  = readdirSync(ttDir).find((f) => f.startsWith(`PPTimetable_${todayY}`) && f.endsWith('.xml.gz'));
if (!ttFile) { console.error('No timetable for today'); process.exit(1); }
console.log(`[demo] indexing ${ttFile} ...`);
const xmlBuf = gunzipSync(readFileSync(resolve(ttDir, ttFile))).toString('utf8');

// "ssd|headcode" -> [{rid, originTiploc, originTime}]
// Inverse: rid -> { ssd, headcode, originTiploc, originTime } so we can
// look up by RID later for the LDS board match.
const headcodeIndex = new Map();
const journeyByRid  = new Map();
const jrgx = /<(?:ns2:)?Journey\b([^>]*?)>([\s\S]*?)<\/(?:ns2:)?Journey>/g;
let jm;
while ((jm = jrgx.exec(xmlBuf))) {
  const attrs = jm[1], body = jm[2];
  const rid     = attrs.match(/\brid="([^"]+)"/)?.[1];
  const trainId = attrs.match(/\btrainId="([^"]+)"/)?.[1];
  const ssd     = attrs.match(/\bssd="([^"]+)"/)?.[1];
  if (!rid || !trainId || !ssd) continue;
  const orm = body.match(/<(?:ns2:)?(?:OR|OPOR)\b([^>]*?)\/?>/);
  if (!orm) continue;
  const oa  = orm[1];
  const tpl = oa.match(/\btpl="([^"]+)"/)?.[1];
  const ptd = oa.match(/\bptd="([^"]+)"/)?.[1];
  const wtd = oa.match(/\bwtd="([^"]+)"/)?.[1];
  const ot  = (ptd || wtd || '').slice(0, 5);
  if (!tpl) continue;
  const j = { rid, trainId, ssd, originTiploc: tpl, originTime: ot };
  journeyByRid.set(rid, j);
  const k = `${ssd}|${trainId}`;
  let arr = headcodeIndex.get(k);
  if (!arr) { arr = []; headcodeIndex.set(k, arr); }
  arr.push(j);
}
console.log(`[demo] indexed ${journeyByRid.size} journeys.`);

// ---------- 2. Capture PTAC consists -------------------------------------
const kafka = new Kafka({
  clientId: 'rs-demo-leeds', brokers: [process.env.PTAC_BOOTSTRAP], ssl: true,
  sasl: { mechanism: 'plain', username: process.env.PTAC_USERNAME, password: process.env.PTAC_PASSWORD },
  logLevel: logLevel.ERROR,
});
const consumer = kafka.consumer({ groupId: process.env.PTAC_GROUP_ID, sessionTimeout: 10000 });
await consumer.connect();
await consumer.subscribe({ topic: process.env.PTAC_TOPIC, fromBeginning: false });

const admin = kafka.admin(); await admin.connect();
let replayOffsets = null;
try { replayOffsets = await admin.fetchTopicOffsetsByTimestamp(process.env.PTAC_TOPIC, Date.now() - REPLAY_MIN * 60_000); }
catch {} finally { await admin.disconnect(); }

const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false, parseTagValue: false,
  trimValues: true, isArray: (n) => ['Allocation','Vehicle','Defect','ResourceGroup','TransportOperationalIdentifiers'].includes(n),
});
const txt = (n) => (n == null ? null : typeof n === 'object' ? (n['#text'] ?? null) : String(n));

// rid -> [{ unit, fleet, vehicles: [...], position }]
const consistByRid = new Map();
let total = 0;
const startedAt = Date.now();

await consumer.run({
  eachMessage: async ({ message }) => {
    if (Date.now() - startedAt > RUN_SEC * 1000) return;
    total++;
    const raw = message.value.toString('utf8');
    const x = raw.indexOf('<?xml'); const stripped = x >= 0 ? raw.slice(x) : raw;
    let doc; try { doc = parser.parse(stripped); } catch { return; }
    const m = doc.PassengerTrainConsistMessage; if (!m) return;
    const allocs = m.Allocation || []; if (!allocs.length) return;
    const tiList = m.TrainOperationalIdentification?.TransportOperationalIdentifiers || [];
    const ti = tiList.find((t) => String(t.Company) !== '0070') || tiList[0] || {};
    const headcode = m.OperationalTrainNumberIdentifier?.OperationalTrainNumber;
    const ssd = ti.StartDate;
    if (!headcode || !ssd) return;

    // Use the FIRST allocation's TrainOriginLocation for the join
    const a0 = allocs[0];
    const originTpl = txt(a0?.TrainOriginLocation?.LocationSubsidiaryIdentification?.LocationSubsidiaryCode);
    const originHHMM = a0?.TrainOriginDateTime?.slice(11, 16);

    // Find the matching Darwin RID
    const cands = headcodeIndex.get(`${ssd}|${headcode}`) || [];
    let match = cands.find((c) => c.originTiploc === originTpl);
    if (!match || (cands.length > 1 && match.originTime !== originHHMM)) {
      const exact = cands.find((c) => c.originTiploc === originTpl && c.originTime === originHHMM);
      if (exact) match = exact;
    }
    if (!match) return;

    // Aggregate every resource group in every allocation into one list,
    // sorted by ResourceGroupPosition (1=leading).
    const groups = [];
    for (const a of allocs) {
      const pos = Number(a.ResourceGroupPosition) || 0;
      for (const rg of (a.ResourceGroup || [])) {
        groups.push({
          position: pos,
          unit: rg.ResourceGroupId,
          fleet: rg.FleetId,
          reversed: a.Reversed === 'Y',
          vehicles: (rg.Vehicle || []).map((v) => ({
            id: v.VehicleId, type: v.SpecificType, seats: Number(v.NumberOfSeats) || null,
            speed: Number(v.MaximumSpeed) || null, defects: (v.Defect || []).length,
            name: v.VehicleName || null,
          })),
        });
      }
    }
    groups.sort((a, b) => (a.position || 99) - (b.position || 99));
    consistByRid.set(match.rid, { groups, ptacCompany: ti.Company, sourceCore: ti.Core });
  },
});

if (replayOffsets) {
  await new Promise((r) => setTimeout(r, 1500));
  for (const o of replayOffsets) consumer.seek({ topic: process.env.PTAC_TOPIC, partition: o.partition, offset: o.offset });
}

setTimeout(async () => {
  console.log(`[demo] processed ${total} PTAC messages → ${consistByRid.size} services with consists cached.`);
  await consumer.disconnect();

  // ---------- 3. Fetch the Leeds board and merge ---------------------------
  let board;
  try { board = await getJSON(`/api/departures/${STATION}?hours=4`); }
  catch (e) { console.error('Failed to reach daemon at :4001 — is it running?', e.message); process.exit(1); }

  const rows = board.departures || [];
  console.log(`\n=== ${board.stationName} (${STATION}) — ${rows.length} departures over ${board.windowHours}h ===\n`);
  console.log('time   plat trainId toc dest                           consist');
  console.log('-----  ---  ------- --- ------------------------------ -----------------------------------------');

  let withConsist = 0;
  for (const r of rows) {
    const consist = consistByRid.get(r.rid);
    let consistStr;
    if (!consist) {
      consistStr = '—';
    } else {
      withConsist++;
      // The same physical unit is broadcast once per allocation leg; collapse
      // by unit number so we only count its vehicles once for seats/cars.
      const uniqUnits = new Map();   // unit -> { fleet, vehicles, defects }
      for (const g of consist.groups) {
        if (!g.unit) continue;
        if (uniqUnits.has(g.unit)) continue;
        uniqUnits.set(g.unit, g);
      }
      const totalSeats = [...uniqUnits.values()].reduce((s, g) => s + g.vehicles.reduce((vs, v) => vs + (v.seats || 0), 0), 0);
      const totalCars  = [...uniqUnits.values()].reduce((s, g) => s + g.vehicles.length, 0);
      const fleets     = [...new Set([...uniqUnits.values()].map((g) => g.fleet).filter(Boolean))];
      const units      = [...uniqUnits.keys()].join('+');
      const defects    = [...uniqUnits.values()].reduce((s, g) => s + g.vehicles.reduce((vs, v) => vs + v.defects, 0), 0);
      consistStr = `${fleets.join(' + ')}  unit ${units}  ${totalCars}c/${totalSeats}s${defects ? `  ⚠${defects}` : ''}`;
    }
    const dest = (r.destinationName || r.destination || '').slice(0, 30).padEnd(30);
    console.log(`${r.scheduledTime} ${(r.platform || '-').toString().padEnd(3)}  ${r.trainId.padEnd(6)}  ${r.toc.padEnd(3)} ${dest} ${consistStr}`);
  }
  console.log(`\n=> ${withConsist}/${rows.length} services had consist data joined from PTAC.`);
  if (withConsist === 0) {
    console.log('   (Leeds is dominated by NT/TPE/XC/GR — none seem to participate in PTAC publishing.)');
  }
  process.exit(0);
}, RUN_SEC * 1000 + 1500);
