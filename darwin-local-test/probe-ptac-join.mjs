/**
 * Phase-1 join validator: build an in-memory headcode index from today's
 * Darwin timetable file, capture PTAC messages, and try to match each one
 * via the 4-tuple (ssd, headcode, originTiploc, originTime).
 *
 * This proves the join key BEFORE we commit to daemon code. The daemon
 * itself can reuse the same index (already built into byRid by the Darwin
 * loader; we'll just add a per-key view on top).
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

const RUN_SEC    = Number(process.env.RUN_SEC || 25);
const REPLAY_MIN = Number(process.env.REPLAY_MIN || 30);

// ---------- 1. Load timetable + build headcode index ---------------------
const ttDir = resolve(__dirname, '../docs/V8s');
const todayYmd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const ttFile = readdirSync(ttDir).find((f) => f.startsWith(`PPTimetable_${todayYmd}`) && f.endsWith('.xml.gz'));
if (!ttFile) { console.error('No timetable for today:', todayYmd); process.exit(1); }
console.log(`[probe] loading timetable ${ttFile} ...`);
const xmlBuf = gunzipSync(readFileSync(resolve(ttDir, ttFile))).toString('utf8');

// Index: "ssd|headcode" -> [{ rid, originTiploc, originTime(HH:MM), toc }]
const headcodeIndex = new Map();
let journeyCount = 0;
const jrgx = /<(?:ns2:)?Journey\b([^>]*?)>([\s\S]*?)<\/(?:ns2:)?Journey>/g;
let jm;
while ((jm = jrgx.exec(xmlBuf))) {
  journeyCount++;
  const attrs = jm[1], body = jm[2];
  const rid     = attrs.match(/\brid="([^"]+)"/)?.[1];
  const trainId = attrs.match(/\btrainId="([^"]+)"/)?.[1];
  const ssd     = attrs.match(/\bssd="([^"]+)"/)?.[1];
  const toc     = attrs.match(/\btoc="([^"]+)"/)?.[1];
  if (!rid || !trainId || !ssd) continue;
  const orm = body.match(/<(?:ns2:)?(?:OR|OPOR)\b([^>]*?)\/?>/);
  if (!orm) continue;
  const oa  = orm[1];
  const tpl = oa.match(/\btpl="([^"]+)"/)?.[1];
  const ptd = oa.match(/\bptd="([^"]+)"/)?.[1];
  const wtd = oa.match(/\bwtd="([^"]+)"/)?.[1];
  const ot  = (ptd || wtd || '').slice(0, 5);
  if (!tpl) continue;
  const key = `${ssd}|${trainId}`;
  let arr = headcodeIndex.get(key);
  if (!arr) { arr = []; headcodeIndex.set(key, arr); }
  arr.push({ rid, originTiploc: tpl, originTime: ot, toc });
}
console.log(`[probe] indexed ${journeyCount} journeys; ${headcodeIndex.size} unique (ssd, headcode) keys.`);

// ---------- 2. Connect to PTAC and replay -------------------------------
const kafka = new Kafka({
  clientId: 'rs-probe-ptac-join', brokers: [process.env.PTAC_BOOTSTRAP], ssl: true,
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

const seen = []; const startedAt = Date.now();
await consumer.run({
  eachMessage: async ({ message }) => {
    if (Date.now() - startedAt > RUN_SEC * 1000) return;
    const raw = message.value.toString('utf8');
    const x = raw.indexOf('<?xml'); const stripped = x >= 0 ? raw.slice(x) : raw;
    let doc; try { doc = parser.parse(stripped); } catch { return; }
    const m = doc.PassengerTrainConsistMessage; if (!m) return;
    const allocs = m.Allocation || []; if (!allocs.length) return;
    const tiList = m.TrainOperationalIdentification?.TransportOperationalIdentifiers || [];
    const ti = tiList.find((t) => String(t.Company) !== '0070') || tiList[0] || {};
    const a0 = allocs[0];
    const originTpl = txt(a0?.TrainOriginLocation?.LocationSubsidiaryIdentification?.LocationSubsidiaryCode);
    const originDt  = a0?.TrainOriginDateTime;
    seen.push({
      headcode:    m.OperationalTrainNumberIdentifier?.OperationalTrainNumber,
      ssd:         ti.StartDate,
      originTpl,
      originHHMM:  originDt?.slice(11, 16),
      ptacCompany: ti.Company,
      sample_unit: a0?.ResourceGroup?.[0]?.ResourceGroupId,
      sample_fleet: a0?.ResourceGroup?.[0]?.FleetId,
    });
  },
});

if (replayOffsets) {
  await new Promise((r) => setTimeout(r, 1500));
  for (const o of replayOffsets) consumer.seek({ topic: process.env.PTAC_TOPIC, partition: o.partition, offset: o.offset });
}

setTimeout(async () => {
  console.log(`\nCaptured ${seen.length} PTAC messages with allocations.`);
  // Try the 4-tuple join.
  let matched = 0, ambiguousByOrigin = 0, ambiguousByTime = 0, headcodeMiss = 0, originMiss = 0;
  const samples = [];
  for (const p of seen) {
    if (!p.headcode || !p.ssd) { headcodeMiss++; continue; }
    const key = `${p.ssd}|${p.headcode}`;
    const cands = headcodeIndex.get(key) || [];
    if (cands.length === 0) { headcodeMiss++; samples.push({ ...p, status: '✗ headcode not in timetable' }); continue; }

    let filtered = cands;
    if (p.originTpl) filtered = cands.filter((c) => c.originTiploc === p.originTpl);
    if (filtered.length === 0) {
      originMiss++;
      samples.push({ ...p, status: `✗ origin mismatch (${cands.length} cand)` , candidates: cands.map((c) => `${c.originTiploc}@${c.originTime}`).slice(0,3) });
      continue;
    }
    if (filtered.length === 1) {
      matched++;
      samples.push({ ...p, status: `✓ ${filtered[0].rid} (toc=${filtered[0].toc})` });
      continue;
    }
    // Multiple — disambiguate by origin time
    const exact = filtered.filter((c) => c.originTime === p.originHHMM);
    if (exact.length === 1) { matched++; samples.push({ ...p, status: `✓ ${exact[0].rid} (toc=${exact[0].toc}, by-time)` }); continue; }
    ambiguousByTime++;
    samples.push({ ...p, status: `~ ambiguous: ${filtered.length} after origin, ${exact.length} after time` });
  }
  console.log(`Result: ${matched} matched, ${ambiguousByTime} ambiguous, ${headcodeMiss} headcode miss, ${originMiss} origin miss`);
  console.log(`(headcode-miss: not in Darwin's passenger timetable — usually ECS / freight / TOC-only services)\n`);
  console.log('First 15 samples:');
  for (const s of samples.slice(0, 15)) {
    console.log(`  ${s.headcode}  ssd=${s.ssd}  origin=${s.originTpl || '?'}@${s.originHHMM || '?'}  toc=${s.ptacCompany}  → ${s.status}${s.candidates ? '  cand=' + s.candidates.join(',') : ''}`);
  }
  // Pull out matched ones with full unit/fleet for the demo summary
  const matched_samples = samples.filter((s) => s.status.startsWith('✓')).slice(0, 5);
  if (matched_samples.length) {
    console.log('\nMatched examples (these will be linkable from Darwin service detail page):');
    for (const s of matched_samples) {
      console.log(`  rid=${s.status.split(' ')[1]}  unit=${s.sample_unit} (${s.sample_fleet})  → http://localhost:3000/services/${s.status.split(' ')[1]}`);
    }
  }
  await consumer.disconnect();
  process.exit(0);
}, RUN_SEC * 1000 + 1500);
