#!/usr/bin/env node
/*
 * Long-running daemon that maintains a rolling departure-board state for a
 * single TIPLOC and writes it to a JSON file every few seconds, so a website
 * (or anything else) can poll the file without coupling to Kafka/timetable.
 *
 * Usage:
 *   TIPLOC=LEEDS npm run daemon
 *   TIPLOC=DWBY WINDOW_HOURS=2 WRITE_INTERVAL_SEC=10 npm run daemon
 *
 * Output:
 *   state/<tiploc>-departures.json     (written atomically every WRITE_INTERVAL_SEC)
 *
 * Env vars:
 *   TIPLOC                  station to track (default LEEDS)
 *   OUTPUT_FILE             override output path (default state/<tiploc>-departures.json)
 *   WINDOW_HOURS            look-ahead in hours (default 3)
 *   WRITE_INTERVAL_SEC      snapshot write interval (default 5)
 *   INITIAL_REPLAY_MIN      seed state from retained Kafka on startup (default 360)
 *   HEARTBEAT_SEC           stats log interval (default 60)
 *   DARWIN_*                Kafka creds from .env
 */

import { readdirSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { loadTimetableForTiploc } from './timetable-loader.mjs';
import { loadTodaysReasons } from './reasons-loader.mjs';
import { loadTodaysLocations, makeResolvers } from './locations-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const cfg = {
  bootstrap:      process.env.DARWIN_BOOTSTRAP,
  username:       process.env.DARWIN_USERNAME,
  password:       process.env.DARWIN_PASSWORD,
  topic:          process.env.DARWIN_TOPIC || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON',
  groupId:        process.env.DARWIN_GROUP_ID,
  tiploc:         (process.env.TIPLOC || process.env.DARWIN_LEEDS_TIPLOC || 'LEEDS').toUpperCase(),
  windowHours:    Number(process.env.WINDOW_HOURS || 3),
  writeInterval:  Number(process.env.WRITE_INTERVAL_SEC || 5),
  initialReplay:  Number(process.env.INITIAL_REPLAY_MIN || 360),
  heartbeat:      Number(process.env.HEARTBEAT_SEC || 60),
};
cfg.outputFile = process.env.OUTPUT_FILE || resolve(__dirname, 'state', `${cfg.tiploc.toLowerCase()}-departures.json`);

// ----- Helpers --------------------------------------------------------------
function asArray(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
function decodeKafkaJson(rawBuf) {
  const v = JSON.parse(rawBuf.toString('utf8'));
  return typeof v.bytes === 'string' ? JSON.parse(v.bytes) : v;
}
function unwrap(v) { return v == null ? v : typeof v === 'object' ? (v['#text'] || v._ || v['']) : v; }
function todayYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function anchorTime(hhmm, ssd) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm);
  if (!m) return null;
  const [, h, mn, s] = m;
  return new Date(`${ssd}T${h.padStart(2, '0')}:${mn}:${s || '00'}+01:00`);
}
function bestDepartureFromLoc(loc) {
  if (loc?.dep?.at) return { time: loc.dep.at, kind: 'actual' };
  if (loc?.dep?.et) return { time: loc.dep.et, kind: 'est' };
  if (loc?.ptd)     return { time: loc.ptd, kind: 'scheduled' };
  if (loc?.wtd)     return { time: loc.wtd, kind: 'working' };
  return null;
}

// ----- Timetable / reasons (reloadable on day rollover) ---------------------
function pickTodaysTimetable() {
  const dirs = [
    resolve(__dirname, '../docs/V8s'),
    resolve(__dirname, '../docs/timetablefiles'),
  ];
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
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

let timetable, lateReasons, cancelReasons, locations, tocs, resolve_, timetablePath, loadedDate;

function reloadReferenceData() {
  timetablePath = pickTodaysTimetable();
  console.log(`[daemon] loading timetable ${timetablePath.split('/').pop()}`);
  timetable = loadTimetableForTiploc(timetablePath, cfg.tiploc);
  ({ lateReasons, cancelReasons } = loadTodaysReasons());
  ({ locations, tocs } = loadTodaysLocations());
  resolve_ = makeResolvers({ locations, tocs });
  loadedDate = todayYmd();
}

reloadReferenceData();

// ----- In-memory state ------------------------------------------------------
// Per-RID rolling state. We don't pre-filter to a window here — filtering is
// applied each time we snapshot, so as the clock moves forward, services slide
// in and out of the rolling view without us having to re-read the timetable.
const liveOverlay = new Map();        // rid -> { bestTime, bestKind, livePlat }
const cancelled   = new Map();        // rid -> { reason, source, code }
const delayReason = new Map();        // rid -> { reason, source, code }
const stats = { consumed: 0, updates: 0, startedAt: new Date().toISOString(), lastWriteAt: null, lastKafkaMsgAt: null };

function processMessage(pport) {
  for (const env of ['uR', 'sR']) {
    const e = pport[env]; if (!e) continue;

    // --- TS: live times, platform, per-location cancel/late ---
    for (const ts of asArray(e.TS)) {
      if (!ts.rid) continue;
      stats.lastKafkaMsgAt = new Date().toISOString();

      if (ts.lateReason) {
        const code = String(unwrap(ts.lateReason));
        delayReason.set(ts.rid, { code, source: 'ts', reason: lateReasons.get(code) || `code ${code}` });
        stats.updates++;
      }
      if (ts.cancelReason) {
        const code = String(unwrap(ts.cancelReason));
        cancelled.set(ts.rid, { code, source: 'ts', reason: cancelReasons.get(code) || `code ${code}` });
        stats.updates++;
      }
      for (const loc of asArray(ts.Location)) {
        if ((loc.tpl || '').toUpperCase() !== cfg.tiploc) continue;
        const cur = liveOverlay.get(ts.rid) || {};
        const dep = bestDepartureFromLoc(loc);
        if (dep && dep.kind !== 'scheduled' && dep.kind !== 'working') {
          cur.bestTime = dep.time; cur.bestKind = dep.kind; stats.updates++;
        }
        const platStr = loc.plat == null ? cur.livePlat
          : typeof loc.plat === 'string' ? loc.plat
          : (loc.plat[''] || loc.plat['#text'] || loc.plat._ || cur.livePlat);
        if (platStr && platStr !== cur.livePlat) {
          cur.livePlat = platStr; stats.updates++;
        }
        liveOverlay.set(ts.rid, cur);
        if (loc.can === 'true' || loc.can === true) {
          if (!cancelled.has(ts.rid)) cancelled.set(ts.rid, { reason: 'cancelled at this stop', source: 'ts-loc' });
          stats.updates++;
        }
        if (loc.lateReason) {
          const code = String(unwrap(loc.lateReason));
          delayReason.set(ts.rid, { code, source: 'ts-loc', reason: lateReasons.get(code) || `code ${code}` });
          stats.updates++;
        }
        if (loc.cancelReason) {
          const code = String(unwrap(loc.cancelReason));
          cancelled.set(ts.rid, { code, source: 'ts-loc', reason: cancelReasons.get(code) || `code ${code}` });
          stats.updates++;
        }
      }
    }

    // --- schedule: full cancellations, per-loc partial cancels ---
    for (const sc of asArray(e.schedule)) {
      if (!sc?.rid) continue;
      if (sc.cancelReason) {
        const code = String(unwrap(sc.cancelReason));
        cancelled.set(sc.rid, { code, source: 'schedule', reason: cancelReasons.get(code) || `code ${code}` });
        stats.updates++;
      }
      for (const k of ['OR','IP','PP','DT','OPOR','OPIP','OPPP','OPDT']) {
        for (const loc of asArray(sc[k])) {
          if ((loc.tpl || '').toUpperCase() !== cfg.tiploc) continue;
          if (loc.can === 'true' || loc.can === true) {
            if (!cancelled.has(sc.rid)) cancelled.set(sc.rid, { source: 'schedule-loc', reason: 'this stop cancelled' });
            stats.updates++;
          }
        }
      }
    }

    // --- deactivated ---
    for (const d of asArray(e.deactivated)) {
      if (!d?.rid) continue;
      if (!cancelled.has(d.rid)) cancelled.set(d.rid, { source: 'deactivated', reason: 'schedule deactivated' });
      stats.updates++;
    }
  }
}

// ----- Snapshot builder -----------------------------------------------------
function buildSnapshot() {
  const now = new Date();
  const horizon = new Date(now.getTime() + cfg.windowHours * 3600_000);
  const ssd = todayYmd(now);
  const rows = [];

  for (const sc of timetable.values()) {
    if (sc.ssd !== ssd) continue;
    if (sc.isPassing) continue;
    if (!sc.time || !sc.time.includes(':')) continue;
    if (sc.activity === 'TF') continue;

    const scheduledAt = anchorTime(sc.time, sc.ssd);
    if (!scheduledAt) continue;
    if (scheduledAt < now - 5 * 60_000) continue;     // small grace for just-departed
    if (scheduledAt > horizon) continue;

    const ov = liveOverlay.get(sc.rid) || {};
    const cancelInfo = cancelled.get(sc.rid) || null;
    const delayInfo  = delayReason.get(sc.rid) || null;

    const bestTime = ov.bestTime || sc.time;
    const bestKind = ov.bestKind || 'scheduled';

    rows.push({
      rid: sc.rid,
      trainId: sc.trainId,
      uid: sc.uid,
      toc: sc.toc,
      tocName: resolve_.tocToName(sc.toc),
      scheduledTime: sc.time,
      scheduledAt: scheduledAt.toISOString(),
      liveTime: bestTime,
      liveKind: bestKind,
      platform: sc.plat || null,
      livePlatform: ov.livePlat || null,
      origin: sc.origin,
      originName: resolve_.tiplocToName(sc.origin),
      originCrs:  resolve_.tiplocToCrs(sc.origin),
      destination: sc.destination,
      destinationName: resolve_.tiplocToName(sc.destination),
      destinationCrs:  resolve_.tiplocToCrs(sc.destination),
      callingAfter: sc.callingAfter || [],
      // Parallel arrays: same length/order as callingAfter; null entries
      // indicate a junction/siding with no CRS code.
      callingAfterNames: (sc.callingAfter || []).map(resolve_.tiplocToName),
      callingAfterCrs:   (sc.callingAfter || []).map(resolve_.tiplocToCrs),
      isPassenger: sc.isPassenger,
      cancelled: cancelInfo ? true : false,
      cancellation: cancelInfo,
      delayReason: delayInfo,
      // Convenient summary field the website can show directly.
      status: cancelInfo
        ? 'CANCELLED'
        : (bestKind === 'scheduled' || bestKind === 'working') ? 'on time'
        : `${bestKind} ${bestTime}`,
    });
  }
  rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return {
    tiploc: cfg.tiploc,
    stationName: resolve_.tiplocToName(cfg.tiploc),
    stationCrs:  resolve_.tiplocToCrs(cfg.tiploc),
    updatedAt: now.toISOString(),
    timetableFile: timetablePath.split('/').pop(),
    windowHours: cfg.windowHours,
    counts: {
      departures: rows.length,
      cancelled:  rows.filter((r) => r.cancelled).length,
      withDelay:  rows.filter((r) => r.delayReason).length,
    },
    kafka: {
      consumed: stats.consumed,
      updatesApplied: stats.updates,
      startedAt: stats.startedAt,
      lastMessageAt: stats.lastKafkaMsgAt,
    },
    departures: rows,
  };
}

function writeSnapshot() {
  const snap = buildSnapshot();
  mkdirSync(dirname(cfg.outputFile), { recursive: true });
  const tmp = cfg.outputFile + '.tmp';
  writeFileSync(tmp, JSON.stringify(snap, null, 2));
  renameSync(tmp, cfg.outputFile);
  stats.lastWriteAt = snap.updatedAt;
}

// ----- Kafka main loop ------------------------------------------------------
const kafka = new Kafka({
  clientId: 'rs-departures-daemon',
  brokers: [cfg.bootstrap], ssl: true,
  sasl: { mechanism: 'plain', username: cfg.username, password: cfg.password },
  connectionTimeout: 15000,
  authenticationTimeout: 15000,
  logLevel: logLevel.WARN,
});
const consumer = kafka.consumer({ groupId: cfg.groupId });

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[daemon] shutting down...');
  try { writeSnapshot(); } catch (e) { console.warn('[daemon] final snapshot failed:', e.message); }
  try { await consumer.disconnect(); } catch { /* */ }
  console.log('[daemon] bye.');
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

console.log(`[daemon] tiploc=${cfg.tiploc} window=${cfg.windowHours}h writeEvery=${cfg.writeInterval}s output=${cfg.outputFile}`);

await consumer.connect();
await consumer.subscribe({ topic: cfg.topic, fromBeginning: false });

// Fetch replay offsets (if any) before run().
let replayOffsets = null;
if (cfg.initialReplay > 0) {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const sinceMs = Date.now() - cfg.initialReplay * 60_000;
    replayOffsets = await admin.fetchTopicOffsetsByTimestamp(cfg.topic, sinceMs);
    console.log(`[daemon] will replay -${cfg.initialReplay} min across ${replayOffsets.length} partition(s).`);
  } catch (e) {
    console.warn(`[daemon] offset fetch failed: ${e.message}`);
  } finally {
    await admin.disconnect();
  }
}

consumer.run({
  eachMessage: async ({ message }) => {
    stats.consumed++;
    let inner;
    try { inner = decodeKafkaJson(message.value); } catch { return; }
    const pport = inner.Pport || inner;
    try { processMessage(pport); } catch (e) { /* don't die on one bad message */ }
  },
}).catch((e) => {
  console.error('[daemon] consumer.run error:', e);
  shutdown();
});

// Apply replay seek after run() has started.
if (replayOffsets) {
  await new Promise((r) => setTimeout(r, 2000));
  for (const o of replayOffsets) {
    try { consumer.seek({ topic: cfg.topic, partition: o.partition, offset: o.offset }); }
    catch (e) { console.warn(`[daemon] seek p${o.partition} failed: ${e.message}`); }
  }
}

// Write snapshots + heartbeats forever.
writeSnapshot();   // initial snapshot immediately (may be empty before Kafka fills in)
setInterval(() => {
  try { writeSnapshot(); } catch (e) { console.warn('[daemon] snapshot write failed:', e.message); }
}, cfg.writeInterval * 1000);

setInterval(() => {
  const snap = buildSnapshot();
  console.log(`[daemon] heartbeat: ${snap.counts.departures} departures (${snap.counts.cancelled} cancelled, ${snap.counts.withDelay} delayed) | consumed=${stats.consumed} updates=${stats.updates} lastMsg=${stats.lastKafkaMsgAt || 'none'}`);
}, cfg.heartbeat * 1000);

// Day rollover: at 02:30 local, try reloading today's timetable.
setInterval(() => {
  const t = todayYmd();
  if (t !== loadedDate) {
    console.log(`[daemon] day rollover detected (${loadedDate} → ${t}), reloading reference data...`);
    try {
      reloadReferenceData();
      // Yesterday's live overlays are no longer relevant; clear them.
      liveOverlay.clear();
      cancelled.clear();
      delayReason.clear();
    } catch (e) {
      console.warn(`[daemon] reload failed (will retry in 5 min): ${e.message}`);
    }
  }
}, 5 * 60_000);
