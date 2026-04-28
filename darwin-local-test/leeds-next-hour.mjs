#!/usr/bin/env node
/*
 * Leeds — next-hour departures from Darwin Push Port.
 *
 * Strategy:
 *   1. Replay retained Kafka messages from the earliest available offset
 *      (`fromBeginning: true`) so we backfill the latest known state for
 *      every active service before we even hit "live".
 *   2. Continue consuming live for `LISTEN_SEC` seconds to absorb fresh
 *      forecasts/actuals.
 *   3. Per RID at Leeds, keep the latest observed departure (highest
 *      precedence: actual `dep.at` > estimated `dep.et` > public `ptd` >
 *      working `wtd`).
 *   4. At the end, print all RIDs whose best-known departure time falls
 *      within [now, now + 60 min], sorted by departure time.
 *
 * Caveats:
 *   - Push Port is event-driven; some quiet services may not be updated in
 *     our window. The snapshot file (S3) is the authoritative source.
 *   - Partition key on Kafka is messageID, not RID, so the same train can
 *     hit either partition. If we only get assigned p0, we miss ~half.
 *   - Times in TS are HH:MM[:SS] with no date; we combine with `ssd`
 *     (scheduled start date) to anchor them, but a service that departs
 *     after midnight will need rollover handling — implemented below.
 */

import { Kafka, logLevel } from 'kafkajs';
import { XMLParser } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const cfg = {
  bootstrap: process.env.DARWIN_BOOTSTRAP,
  username:  process.env.DARWIN_USERNAME,
  password:  process.env.DARWIN_PASSWORD,
  topic:     process.env.DARWIN_TOPIC || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON',
  groupId:   process.env.DARWIN_GROUP_ID,
  tiploc:    (process.env.DARWIN_LEEDS_TIPLOC || 'LEEDS').toUpperCase(),
  listenSec: Number(process.env.LEEDS_LISTEN_SEC || 60),
  windowMin: Number(process.env.LEEDS_WINDOW_MIN || 60),
  fromBeginning: String(process.env.DARWIN_FROM_BEGINNING ?? 'true').toLowerCase() === 'true',
  // How far back to replay so we pick up `schedule` messages for already-active
  // services. The consumer group has committed offsets from another client, so
  // we have to manually `seek()` after group join.
  replayMin: Number(process.env.LEEDS_REPLAY_MIN || 30),
  progressEvery: Number(process.env.LEEDS_PROGRESS_EVERY || 500),
};

if (!cfg.username || !cfg.password) {
  console.error('Missing creds in .env'); process.exit(1);
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
});

// ---- decoder (same auto-detect as index.mjs) ----
function tryGunzip(buf) {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try { return gunzipSync(buf); } catch { /* */ }
  }
  return null;
}
function normaliseJsonPport(obj) {
  if (!obj) return null;
  if (obj.Pport) return obj;
  return { Pport: obj };
}
function decodeKafkaValue(raw) {
  const buf = tryGunzip(raw) || raw;
  const text = buf.toString('utf8');
  const t = text.trimStart();
  if (t.startsWith('<')) return xmlParser.parse(text);
  if (t.startsWith('{') || t.startsWith('[')) {
    const obj = JSON.parse(text);
    if (obj && typeof obj.bytes === 'string') {
      const inner = obj.bytes;
      const ti = inner.trimStart();
      if (ti.startsWith('{')) return normaliseJsonPport(JSON.parse(inner));
      if (ti.startsWith('<')) return xmlParser.parse(inner);
      const innerBuf = Buffer.from(inner, 'base64');
      const innerText = (tryGunzip(innerBuf) || innerBuf).toString('utf8');
      if (innerText.trimStart().startsWith('<')) return xmlParser.parse(innerText);
      return normaliseJsonPport(JSON.parse(innerText));
    }
    return normaliseJsonPport(obj);
  }
  return null;
}

// ---- helpers ----
const asArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (v) => (v == null ? '' : typeof v === 'object' ? (v['#text'] || v._ || '') : String(v));

// Returns { time, kind } where kind is one of: actual | est | scheduled | working | none
// Prefers actual > est > public scheduled > working scheduled.
function bestDepartureFromLoc(loc) {
  if (loc?.dep?.at) return { time: loc.dep.at, kind: 'actual' };
  if (loc?.dep?.et) return { time: loc.dep.et, kind: 'est' };
  if (loc?.pass?.at) return { time: loc.pass.at, kind: 'pass-actual' };
  if (loc?.pass?.et) return { time: loc.pass.et, kind: 'pass-est' };
  if (loc?.ptd) return { time: loc.ptd, kind: 'scheduled' };
  if (loc?.wtd) return { time: loc.wtd, kind: 'working' };
  return { time: '', kind: 'none' };
}

// Anchor an HH:MM[:SS] string against a `ssd` (yyyy-mm-dd) and the current time.
// Handles date rollover for services that depart after midnight on ssd+1.
function anchorTime(hhmm, ssd, now) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm);
  if (!m) return null;
  const [_, h, mn, s] = m;
  const base = ssd ? new Date(`${ssd}T${h.padStart(2, '0')}:${mn}:${s || '00'}+01:00`)
                   : new Date(now);
  if (!ssd) {
    base.setHours(Number(h), Number(mn), Number(s || 0), 0);
  }
  // Rollover: if the anchored time is more than 12h *before* now, assume next-day.
  if (base.getTime() < now.getTime() - 12 * 3600_000) {
    base.setDate(base.getDate() + 1);
  }
  return base;
}

const kafka = new Kafka({
  clientId: 'rs-leeds-next-hour',
  brokers: [cfg.bootstrap],
  ssl: true,
  sasl: { mechanism: 'plain', username: cfg.username, password: cfg.password },
  connectionTimeout: 15000,
  authenticationTimeout: 15000,
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: cfg.groupId });

// JSON-topic naming differs from XML XSD:
//   XML <SC>           -> JSON e.schedule
//   XML <AS>           -> JSON e.association
//   XML <DeactivatedSchedule> -> JSON e.deactivated
//   XML calling points: passenger services use OR/IP/PP/DT (same as XSD);
//   freight/ECS use OPOR/OPIP/OPPP/OPDT (OP prefix). We accept either.
const SCHED_LOC_KEYS = ['OR', 'IP', 'PP', 'DT', 'OPOR', 'OPIP', 'OPPP', 'OPDT'];
const ORIGIN_KEYS = ['OR', 'OPOR'];
const DEST_KEYS   = ['DT', 'OPDT'];

function collectScheduleLocs(sc) {
  const all = [];
  for (const k of SCHED_LOC_KEYS) {
    const v = sc[k];
    if (!v) continue;
    for (const loc of (Array.isArray(v) ? v : [v])) {
      all.push({ ...loc, _slot: k });
    }
  }
  return all;
}

function pickTpl(sc, keys) {
  for (const k of keys) {
    const v = sc[k];
    if (!v) continue;
    const first = Array.isArray(v) ? v[0] : v;
    if (first?.tpl) return first.tpl;
  }
  return '';
}

// rid -> latest known per-RID state
const byRid = new Map();
// rid -> "deactivated" flag (cancelled before run)
const deactivated = new Set();
let consumed = 0;
let scheduleHits = 0;   // schedule messages that mentioned Leeds
const partitionsSeen = new Set();

async function main() {
  // Find the offset corresponding to "now - replayMin" so we can manually seek.
  const replayStartTs = Date.now() - cfg.replayMin * 60_000;
  const admin = kafka.admin();
  await admin.connect();
  let seekOffset = null;
  try {
    const offs = await admin.fetchTopicOffsetsByTimestamp(cfg.topic, replayStartTs);
    seekOffset = offs.find((o) => o.partition === 0)?.offset;
    console.log(`[leeds] offset at now-${cfg.replayMin}min = ${seekOffset}`);
  } catch (e) {
    console.warn('[leeds] could not resolve historical offset:', e.message);
  }
  await admin.disconnect();

  await consumer.connect();
  await consumer.subscribe({ topic: cfg.topic, fromBeginning: cfg.fromBeginning });
  console.log(`[leeds] subscribed (group ${cfg.groupId})`);
  console.log(`[leeds] collecting for ${cfg.listenSec}s, window = next ${cfg.windowMin} min ...`);

  const stopAt = Date.now() + cfg.listenSec * 1000;
  setTimeout(() => shutdown(), cfg.listenSec * 1000);

  // Seek MUST be called after `run()` has started — kafkajs needs the
  // consumer to be in the running state. We schedule it asynchronously.
  if (seekOffset != null) {
    setTimeout(async () => {
      try {
        await consumer.seek({ topic: cfg.topic, partition: 0, offset: String(seekOffset) });
        console.log(`[leeds] seeked p0 to offset ${seekOffset}`);
      } catch (e) {
        console.warn('[leeds] seek failed:', e.message);
      }
    }, 2000);
  }

  let caughtUpAt = null;
  await consumer.run({
    eachMessage: async ({ message, partition }) => {
      consumed++;
      partitionsSeen.add(partition);
      if (Date.now() > stopAt) return;

      // Progress + auto-stop once we've caught up to live.
      if (consumed % cfg.progressEvery === 0) {
        const lag = Date.now() - Number(message.timestamp);
        console.log(`[leeds] ${consumed} consumed, lag=${(lag/1000).toFixed(1)}s, schedules=${scheduleHits}, leeds-rids=${byRid.size}`);
        if (lag < 2000 && !caughtUpAt) {
          caughtUpAt = Date.now();
          console.log('[leeds] caught up to live; stopping early.');
          setTimeout(() => shutdown(), 500);
        }
      }
      let pport;
      try { pport = decodeKafkaValue(message.value)?.Pport; } catch { return; }
      if (!pport) return;

      for (const env of ['uR', 'sR']) {
        const e = pport[env]; if (!e) continue;

        // TS (Actual/Forecast) — primary source of departure times.
        for (const ts of asArray(e.TS)) {
          for (const loc of asArray(ts.Location)) {
            if ((loc.tpl || '').toUpperCase() !== cfg.tiploc) continue;
            const dep = bestDepartureFromLoc(loc);
            if (!dep.time) continue;
            const prev = byRid.get(ts.rid);
            // Always overwrite if newer kind has higher precedence,
            // or simply overwrite (TS messages arrive ordered with
            // forecasts converging to actuals).
            byRid.set(ts.rid, {
              rid: ts.rid,
              ssd: ts.ssd,
              uid: ts.uid,
              plat: text(loc.plat),
              time: dep.time,
              kind: dep.kind,
              observedAt: Date.now(),
              toc: prev?.toc,
              destination: prev?.destination,
              isPassing: !!loc.pass,
            });
          }
        }

        // schedule (XML <SC>) — gives origin, destination, TOC, calling pattern.
        for (const sc of asArray(e.schedule)) {
          const locs = collectScheduleLocs(sc);
          const leedsIdx = locs.findIndex((l) => (l.tpl || '').toUpperCase() === cfg.tiploc);
          if (leedsIdx < 0) continue;
          const leeds = locs[leedsIdx];
          const callingAfter = locs.slice(leedsIdx + 1)
            .filter((l) => l._slot === 'IP' || l._slot === 'OPIP' || l._slot === 'DT' || l._slot === 'OPDT')
            .map((l) => l.tpl);
          const isPassing = leeds._slot === 'PP' || leeds._slot === 'OPPP';
          const existing = byRid.get(sc.rid) || {
            rid: sc.rid, ssd: sc.ssd, uid: sc.uid, plat: text(leeds.plat),
            time: leeds.ptd || leeds.wtd || leeds.pta || leeds.wta || '',
            kind: leeds.ptd ? 'scheduled' : 'working',
            observedAt: Date.now(),
            isPassing,
          };
          existing.toc          = sc.toc;
          existing.trainId      = sc.trainId;
          existing.trainCat     = sc.trainCat;
          existing.isPassenger  = sc.isPassengerSvc !== 'false';
          existing.origin       = pickTpl(sc, ORIGIN_KEYS);
          existing.destination  = pickTpl(sc, DEST_KEYS);
          existing.callingAfter = callingAfter;
          existing.activity     = leeds.act;
          if (!existing.plat) existing.plat = text(leeds.plat);
          byRid.set(sc.rid, existing);
          scheduleHits++;
        }

        // deactivated (XML <DeactivatedSchedule>) — schedule cancelled.
        for (const d of asArray(e.deactivated)) {
          if (d?.rid) deactivated.add(d.rid);
        }
      }
    },
  });

  await new Promise(() => {}); // hold open; setTimeout above triggers shutdown
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try { await consumer.disconnect(); } catch { /* */ }

  const now = new Date();
  const horizon = new Date(now.getTime() + cfg.windowMin * 60_000);
  const rows = [];
  for (const r of byRid.values()) {
    const dt = anchorTime(r.time, r.ssd, now);
    if (!dt) continue;
    if (dt < now || dt > horizon) continue;
    rows.push({ ...r, dt });
  }
  rows.sort((a, b) => a.dt - b.dt);

  console.log(`\n=== Leeds (TIPLOC ${cfg.tiploc}) departures, next ${cfg.windowMin} min ===`);
  console.log(`(now ${now.toISOString()}, horizon ${horizon.toISOString()})`);
  console.log(`(messages consumed: ${consumed}, partitions seen: ${[...partitionsSeen].sort().join(',')}, leeds rids tracked: ${byRid.size})\n`);

  if (rows.length === 0) {
    console.log('No matching services found in the listening window.');
    console.log('Try a longer LEEDS_LISTEN_SEC or a wider LEEDS_WINDOW_MIN.');
  } else {
    const fmt = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });
    console.log('time   plat   trainId  toc  status        rid              from   →  to');
    console.log('-----  -----  -------  ---  ------------  ---------------  ----------------');
    for (const r of rows) {
      const cancelled = deactivated.has(r.rid);
      const t   = fmt(r.dt);
      const pl  = (r.plat || '').padEnd(5);
      const tid = (r.trainId || '----').padEnd(7);
      const toc = (r.toc || '?').padEnd(3);
      let status = r.isPassing ? `pass:${r.kind}` : r.kind;
      if (cancelled) status = 'CANCELLED';
      status = status.padEnd(12);
      const rid = (r.rid || '').padEnd(15);
      const from = (r.origin || '?').padEnd(7);
      const to   = r.destination || '?';
      const calls = r.callingAfter && r.callingAfter.length
        ? `   via ${r.callingAfter.slice(0, 4).join('→')}${r.callingAfter.length > 4 ? '…' : ''}`
        : '';
      console.log(`${t}  ${pl}  ${tid}  ${toc}  ${status}  ${rid}  ${from} → ${to}${calls}`);
    }
    const cancelledCount = rows.filter((r) => deactivated.has(r.rid)).length;
    const passengerCount = rows.filter((r) => r.isPassenger !== false).length;
    console.log(`\n${rows.length} services (${passengerCount} passenger, ${cancelledCount} cancelled). ` +
                `Schedule data captured for ${rows.filter((r) => r.toc).length}.`);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);

main().catch((e) => { console.error('fatal:', e); shutdown(); });
