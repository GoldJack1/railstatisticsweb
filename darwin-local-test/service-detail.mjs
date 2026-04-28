#!/usr/bin/env node
/*
 * Detailed service viewer for Darwin timetable + live overlay.
 *
 * Lookup modes:
 *   RID=202604287192103 node service-detail.mjs                   # by RID
 *   AT=DWBY TIME=15:34  node service-detail.mjs                   # by tiploc+time
 *
 * Prints the full calling pattern (all OR/IP/PP/DT locations) with public &
 * working times. If the service is in the future or close to now, also
 * applies a brief live Kafka overlay (TS forecasts/actuals) per location.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { XMLParser } from 'fast-xml-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const cfg = {
  bootstrap: process.env.DARWIN_BOOTSTRAP,
  username:  process.env.DARWIN_USERNAME,
  password:  process.env.DARWIN_PASSWORD,
  topic:     process.env.DARWIN_TOPIC || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON',
  groupId:   process.env.DARWIN_GROUP_ID,
  rid:       process.env.RID || '',
  atTiploc:  (process.env.AT || '').toUpperCase(),
  atTime:    process.env.TIME || '',
  liveSec:   Number(process.env.LIVE_SEC || 30),
  timetablePath: process.env.LEEDS_TIMETABLE || pickTodaysTimetable(),
};

function pickTodaysTimetable() {
  const dirs = [
    resolve(__dirname, '../docs/V8s'),
    resolve(__dirname, '../docs/timetablefiles'),
  ];
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const all = [];
  for (const dir of dirs) {
    let files = []; try { files = readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.startsWith(`PPTimetable_${ymd}`)) continue;
      if (f.includes('_ref_')) continue;
      if (!f.endsWith('.xml.gz')) continue;
      const ver = Number(f.match(/_v(\d+)\.xml\.gz$/)?.[1] || 0);
      all.push({ path: resolve(dir, f), ver });
    }
  }
  if (all.length === 0) throw new Error(`no timetable file for today (${ymd})`);
  all.sort((a, b) => b.ver - a.ver);
  return all[0].path;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
});

const SCHED_LOC_KEYS = ['OR', 'IP', 'PP', 'DT', 'OPOR', 'OPIP', 'OPPP', 'OPDT'];
function asArray(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
function locTpl(loc) {
  return String(loc?.tpl ?? loc?.ftl ?? '').trim().toUpperCase();
}
function flattenJourney(j) {
  const out = [];
  for (const k of SCHED_LOC_KEYS) {
    if (!(k in j)) continue;
    for (const loc of asArray(j[k])) out.push({ ...loc, _slot: k });
  }
  return out;
}

// -- 1. Find the journey ----------------------------------------------------
function findJourney() {
  const t0 = Date.now();
  const xml = gunzipSync(readFileSync(cfg.timetablePath)).toString('utf8');
  const chunks = xml.split('</Journey>');

  let needles;
  if (cfg.rid) {
    needles = [`rid="${cfg.rid}"`];
  } else if (cfg.atTiploc && cfg.atTime) {
    const padded = cfg.atTiploc.padEnd(8, ' ');
    needles = [`tpl="${cfg.atTiploc}"`, `ftl="${padded}"`];
  } else {
    throw new Error('Set RID=... or AT=<tiploc> TIME=<HH:MM>');
  }

  let parsed = 0;
  for (const c of chunks) {
    if (!needles.some((n) => c.includes(n))) continue;
    const open = c.lastIndexOf('<Journey ');
    if (open < 0) continue;
    const journeyXml = c.slice(open) + '</Journey>';
    let doc; try { doc = xmlParser.parse(journeyXml); } catch { continue; }
    const j = doc.Journey;
    if (!j || !j.rid) continue;
    parsed++;
    if (cfg.rid && j.rid === cfg.rid) {
      console.log(`[svc] matched by rid in ${Date.now() - t0}ms (parsed ${parsed} candidates)`);
      return j;
    }
    if (cfg.atTiploc && cfg.atTime) {
      const slots = flattenJourney(j);
      const at = slots.find((s) => locTpl(s) === cfg.atTiploc);
      if (!at) continue;
      const time = at.ptd || at.wtd || at.pta || at.wta || at.wtp || '';
      if (time && time.startsWith(cfg.atTime)) {
        console.log(`[svc] matched ${cfg.atTiploc} @ ${cfg.atTime} in ${Date.now() - t0}ms (parsed ${parsed} candidates)`);
        return j;
      }
    }
  }
  return null;
}

const journey = findJourney();
if (!journey) {
  console.error('No matching service found.');
  if (cfg.atTiploc && cfg.atTime) {
    console.error(`Try a different TIME (e.g. with seconds), or use RID directly.`);
  }
  process.exit(1);
}

// -- 2. Print scheduled detail ----------------------------------------------
const slotsRaw = flattenJourney(journey);

// fast-xml-parser groups same-named elements together (all <IP>, then all <PP>),
// which loses route order. Sort by the best time at each location, but anchor
// origin (OR/OPOR) at the start and destination (DT/OPDT) at the end so we
// don't get tripped up by services whose times happen to coincide.
function bestTimeOf(s) {
  const t = s.ptd || s.wtd || s.pta || s.wta || s.wtp || '';
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0);
}
const slots = [...slotsRaw].sort((a, b) => {
  if (a._slot === 'OR' || a._slot === 'OPOR') return -1;
  if (b._slot === 'OR' || b._slot === 'OPOR') return 1;
  if (a._slot === 'DT' || a._slot === 'OPDT') return 1;
  if (b._slot === 'DT' || b._slot === 'OPDT') return -1;
  return bestTimeOf(a) - bestTimeOf(b);
});
const SLOT_LABEL = { OR: 'origin', IP: 'stop', PP: 'pass', DT: 'dest', OPOR: 'origin', OPIP: 'stop', OPPP: 'pass', OPDT: 'dest' };
const ACT_LABEL = {
  TB: 'Train Begins',
  TF: 'Train Finishes',
  T:  'Stop',
  'T ': 'Stop',
  'T X': 'Stop, set down only',
  'T D': 'Stop, set down only',
  'T U': 'Stop, pick up only',
  'OPRM': 'Operational stop',
};

console.log('\n================== SERVICE DETAIL ==================');
console.log(`rid:      ${journey.rid}`);
console.log(`uid:      ${journey.uid}`);
console.log(`trainId:  ${journey.trainId || '?'}`);
console.log(`ssd:      ${journey.ssd}`);
console.log(`toc:      ${journey.toc || '?'}`);
console.log(`category: ${journey.trainCat || '?'}`);
console.log(`status:   ${journey.status || '?'}`);
console.log(`passenger:${journey.isPassengerSvc !== 'false'}`);
console.log(`====================================================\n`);
console.log('seq  slot    tpl       plat   pta    ptd    wta       wtd       wtp       activity');
console.log('---  ------  --------  -----  -----  -----  --------  --------  --------  --------------------');
slots.forEach((s, i) => {
  const seq = String(i + 1).padStart(3);
  const slot = (SLOT_LABEL[s._slot] || s._slot).padEnd(6);
  const tpl = locTpl(s).padEnd(8);
  const plat = String(s.plat || '').trim().padEnd(5);
  const pta = String(s.pta || '').padEnd(5);
  const ptd = String(s.ptd || '').padEnd(5);
  const wta = String(s.wta || '').padEnd(8);
  const wtd = String(s.wtd || '').padEnd(8);
  const wtp = String(s.wtp || '').padEnd(8);
  const act = String(s.act || '').trim();
  const actLabel = ACT_LABEL[act] || act;
  console.log(`${seq}  ${slot}  ${tpl}  ${plat}  ${pta}  ${ptd}  ${wta}  ${wtd}  ${wtp}  ${actLabel}`);
});
console.log(`\n${slots.length} locations.`);

// -- 3. Live overlay (optional) ---------------------------------------------
function shouldOverlay() {
  if (cfg.liveSec <= 0) return false;
  // Look for the first/last departure or arrival times — if all are >12h ago,
  // skip overlay (Darwin won't have live data).
  const now = new Date();
  const ssd = journey.ssd;
  if (!ssd) return true;
  const lastTime = (() => {
    for (let i = slots.length - 1; i >= 0; i--) {
      const t = slots[i].ptd || slots[i].wtd || slots[i].pta || slots[i].wta || slots[i].wtp;
      if (t) return t;
    }
    return null;
  })();
  if (!lastTime) return true;
  const m = /^(\d{1,2}):(\d{2})/.exec(lastTime);
  if (!m) return true;
  const ssdAtTime = new Date(`${ssd}T${m[1].padStart(2, '0')}:${m[2]}:00+01:00`);
  // If the service finished more than ~30 min ago, no live data.
  return ssdAtTime.getTime() > now.getTime() - 30 * 60_000;
}

async function liveOverlay() {
  if (!shouldOverlay()) {
    console.log('\n[svc] service is in the past — skipping live overlay.');
    return;
  }
  if (!cfg.username || !cfg.password) {
    console.warn('\n[svc] no Kafka creds — skipping live overlay.');
    return;
  }

  console.log(`\n[svc] listening live for ${cfg.liveSec}s for TS updates on rid=${journey.rid} ...`);

  const kafka = new Kafka({
    clientId: 'rs-svc-detail',
    brokers: [cfg.bootstrap], ssl: true,
    sasl: { mechanism: 'plain', username: cfg.username, password: cfg.password },
    connectionTimeout: 15000,
    authenticationTimeout: 15000,
    logLevel: logLevel.WARN,
  });
  const consumer = kafka.consumer({ groupId: cfg.groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: cfg.topic, fromBeginning: false });

  // tpl -> latest live state at that location
  const updates = new Map();
  let consumed = 0; let hits = 0;

  const stopAt = Date.now() + cfg.liveSec * 1000;
  const done = new Promise((res) => {
    setTimeout(async () => {
      try { await consumer.disconnect(); } catch { /* */ }
      res();
    }, cfg.liveSec * 1000);
  });

  consumer.run({
    eachMessage: async ({ message }) => {
      consumed++;
      if (Date.now() > stopAt) return;
      let inner;
      try {
        const raw = JSON.parse(message.value.toString());
        inner = typeof raw.bytes === 'string' ? JSON.parse(raw.bytes) : raw;
      } catch { return; }
      const pport = inner.Pport || inner;
      for (const env of ['uR', 'sR']) {
        const e = pport[env]; if (!e) continue;
        for (const ts of asArray(e.TS)) {
          if (ts.rid !== journey.rid) continue;
          hits++;
          for (const loc of asArray(ts.Location)) {
            const key = String(loc.tpl || '').toUpperCase();
            const prev = updates.get(key) || {};
            // plat in the JSON feed: { platsrc:"A", conf:"true", "": "16" }
            // (empty-string key holds the platform number — element text content
            // when attributes are promoted alongside it).
            const platStr = loc.plat == null ? prev.plat
              : typeof loc.plat === 'string' ? loc.plat
              : (loc.plat[''] || loc.plat['#text'] || loc.plat._ || prev.plat);
            updates.set(key, {
              ...prev,
              plat: platStr,
              platsrc: loc.plat?.platsrc || prev.platsrc,
              platConf: loc.plat?.conf || prev.platConf,
              arrAt: loc?.arr?.at || prev.arrAt,
              arrEt: loc?.arr?.et || prev.arrEt,
              depAt: loc?.dep?.at || prev.depAt,
              depEt: loc?.dep?.et || prev.depEt,
              passAt: loc?.pass?.at || prev.passAt,
              passEt: loc?.pass?.et || prev.passEt,
            });
          }
        }
      }
    },
  }).catch(() => {});

  await done;
  console.log(`[svc] live overlay done. consumed=${consumed} hits-for-rid=${hits} updated-locations=${updates.size}`);

  if (updates.size === 0) {
    console.log('[svc] no TS updates received for this rid in the listening window.');
    console.log('[svc] (Darwin only emits TS while the train is being tracked. Try a later run, or replay history once you have RDM-historical access.)');
    return;
  }

  console.log('\n=== LIVE STATE PER LOCATION (scheduled vs live) ===');
  console.log('tpl       plat   sched-arr  sched-dep  live-arr        live-dep        delta');
  console.log('--------  -----  ---------  ---------  --------------  --------------  -----');
  function diffMin(actual, scheduled) {
    if (!actual || !scheduled) return '';
    const ma = /^(\d{1,2}):(\d{2})/.exec(actual);
    const ms = /^(\d{1,2}):(\d{2})/.exec(scheduled);
    if (!ma || !ms) return '';
    const dm = (Number(ma[1]) * 60 + Number(ma[2])) - (Number(ms[1]) * 60 + Number(ms[2]));
    if (dm === 0) return 'on time';
    return dm > 0 ? `+${dm}m` : `${dm}m`;
  }
  for (const s of slots) {
    const tpl = locTpl(s);
    const u = updates.get(tpl);
    if (!u) continue;
    const liveArr = u.arrAt ? `${u.arrAt} (act)` : u.arrEt ? `${u.arrEt} (est)` : u.passAt ? `${u.passAt} (pass)` : u.passEt ? `${u.passEt} (pass-est)` : '';
    const liveDep = u.depAt ? `${u.depAt} (act)` : u.depEt ? `${u.depEt} (est)` : '';
    const delta = diffMin(u.depAt || u.arrAt || u.passAt, s.ptd || s.pta || s.wtp);
    console.log(
      `${tpl.padEnd(8)}  ${(u.plat || '').toString().padEnd(5)}  ` +
      `${String(s.pta || '').padEnd(9)}  ${String(s.ptd || '').padEnd(9)}  ` +
      `${liveArr.padEnd(14)}  ${liveDep.padEnd(14)}  ${delta}`
    );
  }
}

await liveOverlay();
process.exit(0);
