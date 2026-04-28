#!/usr/bin/env node
/*
 * Leeds — next-hour departures, full version.
 *
 * Source of truth: the daily PPTimetable .xml.gz file. This gives us TOC,
 * trainId, origin, destination, calling pattern, scheduled platform and time
 * for every service that touches Leeds — including services not currently
 * being updated by the live feed.
 *
 * Live overlay (optional): listen on the Push Port Kafka topic for ~30s and
 * apply forecasts (`et`), actuals (`at`), platform changes, and cancellations
 * to the timetable rows.
 *
 * Usage:
 *   node leeds-departures.mjs                 # uses LIVE_SEC=30 by default
 *   LIVE_SEC=0 node leeds-departures.mjs      # timetable only, no Kafka
 *   LEEDS_WINDOW_MIN=120 node leeds-departures.mjs
 *   LEEDS_TIMETABLE=/path/to/file.xml.gz node leeds-departures.mjs
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { loadTimetableForTiploc } from './timetable-loader.mjs';
import { loadTodaysReasons } from './reasons-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const cfg = {
  bootstrap: process.env.DARWIN_BOOTSTRAP,
  username:  process.env.DARWIN_USERNAME,
  password:  process.env.DARWIN_PASSWORD,
  topic:     process.env.DARWIN_TOPIC || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON',
  groupId:   process.env.DARWIN_GROUP_ID,
  tiploc:    (process.env.DARWIN_LEEDS_TIPLOC || 'LEEDS').toUpperCase(),
  windowMin: Number(process.env.LEEDS_WINDOW_MIN || 60),
  // Optional explicit absolute window: WINDOW_START / WINDOW_END as "HH:MM"
  // (anchored to today). When both set, windowMin is ignored.
  windowStart: process.env.WINDOW_START || '',
  windowEnd:   process.env.WINDOW_END   || '',
  liveSec:   Number(process.env.LIVE_SEC || 30),
  // Seek back this many minutes on startup to replay retained messages
  // (needed to catch schedule cancellations announced earlier today).
  replayMin: Number(process.env.REPLAY_MIN || 0),
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
    let files = [];
    try { files = readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.startsWith(`PPTimetable_${ymd}`)) continue;
      if (f.includes('_ref_')) continue;
      if (!f.endsWith('.xml.gz')) continue;
      const ver = Number(f.match(/_v(\d+)\.xml\.gz$/)?.[1] || 0);
      all.push({ path: resolve(dir, f), ver });
    }
  }
  if (all.length === 0) {
    throw new Error(`no timetable file for today (${ymd}) found in ${dirs.join(' or ')}`);
  }
  all.sort((a, b) => b.ver - a.ver);   // highest version first
  return all[0].path;
}

// -- decoder & helpers (lightweight subset) ----------------------------------
function asArray(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
function text(v) { return v == null ? '' : typeof v === 'object' ? (v['#text'] || v._ || '') : String(v); }
function decodeKafkaJson(raw) {
  const t = raw.toString('utf8');
  const v = JSON.parse(t);
  if (typeof v.bytes === 'string') return JSON.parse(v.bytes);
  return v;
}
function bestDepartureFromLoc(loc) {
  if (loc?.dep?.at) return { time: loc.dep.at, kind: 'actual' };
  if (loc?.dep?.et) return { time: loc.dep.et, kind: 'est' };
  if (loc?.ptd)     return { time: loc.ptd, kind: 'scheduled' };
  if (loc?.wtd)     return { time: loc.wtd, kind: 'working' };
  return null;
}
function anchorTime(hhmm, ssd, now) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm);
  if (!m) return null;
  const [, h, mn, s] = m;
  const base = ssd
    ? new Date(`${ssd}T${h.padStart(2, '0')}:${mn}:${s || '00'}+01:00`)
    : new Date(now);
  if (!ssd) base.setHours(Number(h), Number(mn), Number(s || 0), 0);
  if (base.getTime() < now.getTime() - 12 * 3600_000) {
    base.setDate(base.getDate() + 1);
  }
  return base;
}

// -- 1. Load timetable (source of truth) -------------------------------------
console.log(`[leeds] loading timetable: ${cfg.timetablePath.split('/').pop()}`);
const timetable = loadTimetableForTiploc(cfg.timetablePath, cfg.tiploc);

// Filter to today + DEPARTING (not terminating, not just passing) + within
// our chosen window.
const now = new Date();
const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

function todayAt(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`bad time "${hhmm}", expected HH:MM`);
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

let windowFrom, windowTo;
if (cfg.windowStart && cfg.windowEnd) {
  windowFrom = todayAt(cfg.windowStart);
  windowTo   = todayAt(cfg.windowEnd);
  console.log(`[leeds] absolute window ${cfg.windowStart} → ${cfg.windowEnd} today`);
} else {
  windowFrom = now;
  windowTo   = new Date(now.getTime() + cfg.windowMin * 60_000);
}

// Load reasons reference tables.
const { lateReasons, cancelReasons } = loadTodaysReasons();

// rid -> live overlay (may be absent if the service is steady-state today)
const live = new Map();
const cancelled = new Map();  // rid -> { reason, source } — reason text if known
const delayReason = new Map(); // rid -> { reason, source }

const departureRows = [];
for (const sc of timetable.values()) {
  if (sc.ssd !== todayYmd) continue;          // wrong service date
  if (sc.isPassing) continue;                  // pure passing through
  if (!sc.time || !sc.time.includes(':')) continue;
  // Skip terminating arrivals: we don't have a slot field on the result
  // anymore, but the loader returns activity. Terminating activities are TF.
  if (sc.activity === 'TF') continue;
  // Skip light/empty stock that doesn't carry passengers if you want, but
  // ECS moves still depart Leeds and may interest us — keep them.

  const dt = anchorTime(sc.time, sc.ssd, now);
  if (!dt) continue;
  if (dt < windowFrom || dt > windowTo) continue;

  departureRows.push({
    ...sc,
    scheduledAt: dt,
    bestTime: sc.time,
    bestKind: 'scheduled',
    livePlat: null,
    liveTimeAt: null,
  });
}
departureRows.sort((a, b) => a.scheduledAt - b.scheduledAt);
console.log(`[leeds] timetable says ${departureRows.length} services depart ${cfg.tiploc} in window.`);

// -- 2. Optional live overlay -----------------------------------------------
const ridToRow = new Map(departureRows.map((r) => [r.rid, r]));

async function liveOverlay() {
  if (cfg.liveSec <= 0) {
    console.log('[leeds] LIVE_SEC=0, skipping live overlay.');
    return;
  }
  if (windowTo < now) {
    console.log('[leeds] window is fully in the past — skipping live overlay (forecasts only apply to future).');
    return;
  }
  if (!cfg.username || !cfg.password) {
    console.warn('[leeds] no Kafka creds, skipping live overlay.');
    return;
  }

  const kafka = new Kafka({
    clientId: 'rs-leeds-departures',
    brokers: [cfg.bootstrap],
    ssl: true,
    sasl: { mechanism: 'plain', username: cfg.username, password: cfg.password },
    connectionTimeout: 15000,
    authenticationTimeout: 15000,
    logLevel: logLevel.WARN,
  });
  const consumer = kafka.consumer({ groupId: cfg.groupId });

  await consumer.connect();
  await consumer.subscribe({ topic: cfg.topic, fromBeginning: false });

  // Fetch replay offsets before run() (read-only admin op); apply after run().
  let replayOffsets = null;
  if (cfg.replayMin > 0) {
    const admin = kafka.admin();
    await admin.connect();
    try {
      const sinceMs = Date.now() - cfg.replayMin * 60_000;
      replayOffsets = await admin.fetchTopicOffsetsByTimestamp(cfg.topic, sinceMs);
      console.log(`[leeds] replay seek target: -${cfg.replayMin} min (${replayOffsets.length} partition(s)).`);
    } catch (e) {
      console.warn(`[leeds] replay offset fetch failed: ${e.message}`);
    } finally {
      await admin.disconnect();
    }
  }

  console.log(`[leeds] listening${cfg.replayMin > 0 ? ` (with ${cfg.replayMin}-min replay)` : ' live'} for ${cfg.liveSec}s ...`);

  const stopAt = Date.now() + cfg.liveSec * 1000;
  let consumed = 0;
  let updates = 0;

  const done = new Promise((res) => {
    setTimeout(async () => {
      try { await consumer.disconnect(); } catch { /* */ }
      console.log(`[leeds] live overlay done. consumed=${consumed} updates-applied=${updates}`);
      res();
    }, cfg.liveSec * 1000);
  });

  consumer.run({
    eachMessage: async ({ message }) => {
      consumed++;
      if (Date.now() > stopAt) return;
      let inner;
      try { inner = decodeKafkaJson(message.value); } catch { return; }
      const pport = inner.Pport || inner;
      for (const env of ['uR', 'sR']) {
        const e = pport[env]; if (!e) continue;

        // --- TS messages: live times, platform, per-location late/cancel ---
        for (const ts of asArray(e.TS)) {
          const row = ridToRow.get(ts.rid);
          if (!row) continue;

          // TS-level reason codes (may appear at top-level or at our location).
          if (ts.lateReason) {
            const code = String(ts.lateReason['#text'] || ts.lateReason._ || ts.lateReason);
            delayReason.set(ts.rid, { reason: lateReasons.get(code) || `code ${code}`, source: 'ts' });
            updates++;
          }
          if (ts.cancelReason) {
            const code = String(ts.cancelReason['#text'] || ts.cancelReason._ || ts.cancelReason);
            cancelled.set(ts.rid, { reason: cancelReasons.get(code) || `code ${code}`, source: 'ts' });
            updates++;
          }

          for (const loc of asArray(ts.Location)) {
            if ((loc.tpl || '').toUpperCase() !== cfg.tiploc) continue;

            const dep = bestDepartureFromLoc(loc);
            if (dep && dep.kind !== 'scheduled' && dep.kind !== 'working') {
              row.bestTime = dep.time;
              row.bestKind = dep.kind;
              updates++;
            }
            const platRaw = text(loc.plat);
            if (platRaw && platRaw !== row.plat) {
              row.livePlat = platRaw;
              updates++;
            }
            // Per-location cancellation (partial cancel — train doesn't call here)
            if (loc.can === 'true' || loc.can === true) {
              if (!cancelled.has(ts.rid)) {
                cancelled.set(ts.rid, { reason: 'cancelled at this stop', source: 'ts-loc' });
              }
              updates++;
            }
            // Per-location reason codes
            if (loc.lateReason) {
              const code = String(loc.lateReason['#text'] || loc.lateReason._ || loc.lateReason);
              delayReason.set(ts.rid, { reason: lateReasons.get(code) || `code ${code}`, source: 'ts-loc' });
              updates++;
            }
            if (loc.cancelReason) {
              const code = String(loc.cancelReason['#text'] || loc.cancelReason._ || loc.cancelReason);
              cancelled.set(ts.rid, { reason: cancelReasons.get(code) || `code ${code}`, source: 'ts-loc' });
              updates++;
            }
          }
        }

        // --- schedule messages: full cancellation with reason is common here ---
        for (const sc of asArray(e.schedule)) {
          if (!sc?.rid || !ridToRow.has(sc.rid)) continue;
          if (sc.cancelReason) {
            const code = String(sc.cancelReason['#text'] || sc.cancelReason._ || sc.cancelReason);
            cancelled.set(sc.rid, { reason: cancelReasons.get(code) || `code ${code}`, source: 'schedule' });
            updates++;
          }
          // Per-location can="true" → check if OUR tiploc is cancelled in this message.
          for (const slotKey of ['OR','IP','PP','DT','OPOR','OPIP','OPPP','OPDT']) {
            for (const loc of asArray(sc[slotKey])) {
              if ((loc.tpl || '').toUpperCase() !== cfg.tiploc) continue;
              if (loc.can === 'true' || loc.can === true) {
                if (!cancelled.has(sc.rid)) {
                  cancelled.set(sc.rid, { reason: 'this stop cancelled', source: 'schedule-loc' });
                }
                updates++;
              }
            }
          }
        }

        // --- deactivated: no reason, just the rid ---
        for (const d of asArray(e.deactivated)) {
          if (d?.rid && ridToRow.has(d.rid)) {
            if (!cancelled.has(d.rid)) cancelled.set(d.rid, { reason: 'schedule deactivated', source: 'deactivated' });
            updates++;
          }
        }
      }
    },
  }).catch(() => { /* swallow */ });

  // Apply replay seek now that run() has started (kafkajs requirement).
  if (replayOffsets) {
    // Give the consumer a moment to become assigned to its partitions.
    await new Promise((r) => setTimeout(r, 2000));
    for (const o of replayOffsets) {
      try {
        consumer.seek({ topic: cfg.topic, partition: o.partition, offset: o.offset });
      } catch (e) {
        console.warn(`[leeds] seek p${o.partition} -> ${o.offset} failed: ${e.message}`);
      }
    }
  }

  await done;
}

await liveOverlay();

// -- 3. Print final table ----------------------------------------------------
const fmt = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });
console.log(`\n=== ${cfg.tiploc} departures, ${fmt(windowFrom)} → ${fmt(windowTo)} ===`);
console.log(`(now ${now.toISOString()})`);
console.log(`(${departureRows.length} scheduled, ${cancelled.size} cancelled, ${delayReason.size} with delay reason)\n`);
console.log('time   plat   trainId  toc  status      from   →  to (calling: …)');
console.log('-----  -----  -------  ---  ----------  ---------------------------------------');
for (const r of departureRows) {
  const cancelInfo = cancelled.get(r.rid);
  const delayInfo  = delayReason.get(r.rid);
  const t   = fmt(r.scheduledAt);
  const plat = (r.livePlat || r.plat || '--').padEnd(5);
  const tid  = (r.trainId || '----').padEnd(7);
  const toc  = (r.toc || '?').padEnd(3);
  let status = cancelInfo ? 'CANCELLED'
             : r.bestKind === 'scheduled' || r.bestKind === 'working' ? 'on time'
             : `${r.bestKind} ${r.bestTime}`;
  status = status.padEnd(10);
  const from = (r.origin || '?').padEnd(7);
  const to   = r.destination || '?';
  const calls = r.callingAfter && r.callingAfter.length
    ? `   (${r.callingAfter.slice(0, 5).join(' → ')}${r.callingAfter.length > 5 ? ' → …' : ''})`
    : '';
  console.log(`${t}  ${plat}  ${tid}  ${toc}  ${status}  ${from} → ${to}${calls}`);
  // Surface reason on a second indented line when we know one.
  if (cancelInfo) {
    console.log(`       ↳ reason: ${cancelInfo.reason}  [${cancelInfo.source}]`);
  } else if (delayInfo) {
    console.log(`       ↳ delay reason: ${delayInfo.reason}  [${delayInfo.source}]`);
  }
}
process.exit(0);
