#!/usr/bin/env node
/*
 * Darwin live-departures daemon.
 *
 * Long-running process that:
 *   1. Loads the whole UK timetable for today (one file, ~5s) and builds a
 *      per-TIPLOC index of every calling point.
 *   2. Loads LocationRef + TocRef + Late/Cancel reason tables from the
 *      matching `ref_v*.xml.gz` file.
 *   3. Connects to the Darwin Push Port Kafka topic, replays the last
 *      INITIAL_REPLAY_MIN minutes, and then streams live forever. Live
 *      overlay state (forecasts, actuals, cancellations, delay reasons) is
 *      kept in memory keyed by RID.
 *   4. Exposes a small HTTP API on DAEMON_PORT (default 4001) that the
 *      website (or anything else) can hit to get current departure boards
 *      for any station on demand.
 *
 * Endpoints:
 *   GET  /api/health
 *   GET  /api/station/:code
 *   GET  /api/departures/:code?hours=N
 *   GET  /api/service/:rid
 *
 * Env vars (all optional except DARWIN_*):
 *   DAEMON_PORT            HTTP port (default 4001)
 *   CORS_ORIGIN            Access-Control-Allow-Origin (default http://localhost:5173)
 *   DEFAULT_WINDOW_HOURS   default look-ahead when ?hours is omitted (default 3)
 *   INITIAL_REPLAY_MIN     Kafka replay on startup (default 360)
 *   HEARTBEAT_SEC          stats log interval (default 60)
 *   DARWIN_*               Kafka creds from .env
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { loadAllJourneysIndexedByTiploc } from './timetable-loader.mjs';
import { loadTodaysReasons } from './reasons-loader.mjs';
import { loadTodaysLocations, makeResolvers } from './locations-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const cfg = {
  bootstrap:       process.env.DARWIN_BOOTSTRAP,
  username:        process.env.DARWIN_USERNAME,
  password:        process.env.DARWIN_PASSWORD,
  topic:           process.env.DARWIN_TOPIC || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON',
  groupId:         process.env.DARWIN_GROUP_ID,
  port:            Number(process.env.DAEMON_PORT || 4001),
  // Comma-separated list. The handler echoes the matching origin (or "*" if
  // the special "*" entry is present) so multiple local dev URLs can connect.
  corsOrigins:     (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001').split(',').map((s) => s.trim()),
  windowHours:     Number(process.env.DEFAULT_WINDOW_HOURS || 3),
  initialReplay:   Number(process.env.INITIAL_REPLAY_MIN || 360),
  heartbeat:       Number(process.env.HEARTBEAT_SEC || 60),
};

// ---------- pick today's timetable file ------------------------------------
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

// ---------- helpers --------------------------------------------------------
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
function bestDepartureFromLiveLoc(loc) {
  if (loc?.dep?.at) return { time: loc.dep.at, kind: 'actual' };
  if (loc?.dep?.et) return { time: loc.dep.et, kind: 'est' };
  if (loc?.arr?.at) return { time: loc.arr.at, kind: 'actual-arr' };
  if (loc?.arr?.et) return { time: loc.arr.et, kind: 'est-arr' };
  return null;
}

// ---------- reference data (reloadable on day rollover) --------------------
let byRid, byTiploc;                  // from timetable
let lateReasons, cancelReasons;       // from ref file
let locations, tocs, resolve_;        // from ref file
let crsToTiplocs;                     // CRS -> Array<TIPLOC>
let timetablePath, loadedDate;

function reloadReferenceData() {
  timetablePath = pickTodaysTimetable();
  console.log(`[daemon] loading timetable ${timetablePath.split('/').pop()}`);
  ({ byRid, byTiploc } = loadAllJourneysIndexedByTiploc(timetablePath));
  ({ lateReasons, cancelReasons } = loadTodaysReasons());
  ({ locations, tocs } = loadTodaysLocations());
  resolve_ = makeResolvers({ locations, tocs });

  crsToTiplocs = new Map();
  for (const [tpl, info] of locations) {
    if (!info.crs) continue;
    const crs = info.crs.toUpperCase();
    let arr = crsToTiplocs.get(crs);
    if (!arr) { arr = []; crsToTiplocs.set(crs, arr); }
    arr.push(tpl);
  }
  loadedDate = todayYmd();
}

reloadReferenceData();

// ---------- live overlay state (keyed by RID, global) ----------------------
const liveOverlayByRid = new Map();   // rid -> { locs: Map<tpl, {ptd,pta,plat,...}>, latestTs }
const cancelled   = new Map();        // rid -> { reason, source, code? }
const delayReason = new Map();        // rid -> { reason, source, code? }
const stats = {
  consumed: 0,
  updates:  0,
  startedAt: new Date().toISOString(),
  lastKafkaMsgAt: null,
};

function getOverlay(rid) {
  let o = liveOverlayByRid.get(rid);
  if (!o) { o = { locs: new Map() }; liveOverlayByRid.set(rid, o); }
  return o;
}

function processMessage(pport) {
  for (const env of ['uR', 'sR']) {
    const e = pport[env]; if (!e) continue;

    // --- TS (live times per location) ---
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

      const ov = getOverlay(ts.rid);
      for (const loc of asArray(ts.Location)) {
        const tpl = String(loc.tpl || '').toUpperCase();
        if (!tpl) continue;
        let entry = ov.locs.get(tpl);
        if (!entry) { entry = {}; ov.locs.set(tpl, entry); }

        const dep = bestDepartureFromLiveLoc(loc);
        if (dep) { entry.bestTime = dep.time; entry.bestKind = dep.kind; stats.updates++; }

        // plat in JSON feed: { platsrc, conf, "": "3A" }
        if (loc.plat != null) {
          const platStr = typeof loc.plat === 'string' ? loc.plat
            : (loc.plat[''] || loc.plat['#text'] || loc.plat._);
          if (platStr && platStr !== entry.livePlat) { entry.livePlat = platStr; stats.updates++; }
        }
        if (loc.can === 'true' || loc.can === true) {
          entry.cancelled = true;
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

    // --- schedule (full / partial cancellations announced up-front) ---
    for (const sc of asArray(e.schedule)) {
      if (!sc?.rid) continue;
      if (sc.cancelReason) {
        const code = String(unwrap(sc.cancelReason));
        cancelled.set(sc.rid, { code, source: 'schedule', reason: cancelReasons.get(code) || `code ${code}` });
        stats.updates++;
      }
      for (const k of ['OR','IP','PP','DT','OPOR','OPIP','OPPP','OPDT']) {
        for (const loc of asArray(sc[k])) {
          const tpl = String(loc.tpl || '').toUpperCase();
          if (!tpl) continue;
          if (loc.can === 'true' || loc.can === true) {
            const ov = getOverlay(sc.rid);
            let entry = ov.locs.get(tpl);
            if (!entry) { entry = {}; ov.locs.set(tpl, entry); }
            entry.cancelled = true;
            if (!cancelled.has(sc.rid)) cancelled.set(sc.rid, { source: 'schedule-loc', reason: 'this stop cancelled' });
            stats.updates++;
          }
        }
      }
    }

    // --- deactivated (schedule removed, no reason) ---
    for (const d of asArray(e.deactivated)) {
      if (!d?.rid) continue;
      if (!cancelled.has(d.rid)) cancelled.set(d.rid, { source: 'deactivated', reason: 'schedule deactivated' });
      stats.updates++;
    }
  }
}

// ---------- snapshot builder (per-TIPLOC, on demand) -----------------------
function buildDeparturesForTiplocs(tiplocs, windowHours) {
  // tiplocs is an array — large interchanges share a CRS across multiple
  // TIPLOCs (e.g. STP = STPX [plat 1-4] + STPANCI [plat 5-13] + STPXBOX
  // [Thameslink low-level plat A]); a single CRS query must return all of
  // them. Single-TIPLOC queries pass a 1-element array.
  if (!Array.isArray(tiplocs) || tiplocs.length === 0) return null;

  const upper = tiplocs.map((t) => t.toUpperCase());
  // Build the combined entry list, tagging each entry with its source TIPLOC
  // so the snapshot row records WHICH platform group it came from.
  const entries = [];
  let anyKnown = false;
  for (const tip of upper) {
    const list = byTiploc.get(tip);
    if (!list) continue;
    anyKnown = true;
    for (const e of list) entries.push({ ...e, sourceTpl: tip });
  }
  if (!anyKnown) return null;

  const now = new Date();
  const horizon = new Date(now.getTime() + windowHours * 3600_000);
  const ssd = todayYmd(now);
  const rows = [];
  const seenRids = new Set();   // a service may appear at >1 TIPLOC of the
                                // same station; emit it once.

  for (const { rid, stopIdx, sourceTpl } of entries) {
    if (seenRids.has(rid)) continue;     // de-dupe: a service shouldn't appear twice
    const j = byRid.get(rid);
    if (!j || j.ssd !== ssd) continue;

    const stop = j.slots[stopIdx];
    // Skip pure passing points — not a departure from this station.
    if (stop.slot === 'PP' || stop.slot === 'OPPP') continue;
    // Skip terminating arrivals (train ends here, not departing).
    if (stop.slot === 'DT' || stop.slot === 'OPDT' || stop.act === 'TF') continue;

    const scheduledTime = stop.ptd || stop.wtd;
    if (!scheduledTime || !scheduledTime.includes(':')) continue;

    const scheduledAt = anchorTime(scheduledTime, j.ssd);
    if (!scheduledAt) continue;
    if (scheduledAt.getTime() < now.getTime() - 5 * 60_000) continue;  // small grace for just-departed
    if (scheduledAt > horizon) continue;

    seenRids.add(rid);

    // Live overlay: look up per-TIPLOC entry for this RID using the SOURCE
    // tiploc this row came from (Darwin keys live state by exact TIPLOC).
    const ov = liveOverlayByRid.get(rid);
    const liveLoc = ov?.locs?.get(sourceTpl) || null;
    const bestTime = liveLoc?.bestTime || scheduledTime;
    const bestKind = liveLoc?.bestKind || 'scheduled';

    const cancelInfo = cancelled.get(rid) || null;
    const delayInfo  = delayReason.get(rid) || null;

    // Calling pattern after this stop (only actual passenger stops, not PPs).
    const callingAfter = [];
    for (let i = stopIdx + 1; i < j.slots.length; i++) {
      const s = j.slots[i];
      if (s.slot === 'PP' || s.slot === 'OPPP') continue;
      callingAfter.push(s.tpl);
    }

    rows.push({
      rid: j.rid,
      trainId: j.trainId,
      uid: j.uid,
      toc: j.toc,
      tocName: resolve_.tocToName(j.toc),
      scheduledTime,
      scheduledAt: scheduledAt.toISOString(),
      liveTime: bestTime,
      liveKind: bestKind,
      platform: stop.plat,
      livePlatform: liveLoc?.livePlat || null,
      // Which platform-group TIPLOC this row came from. Useful when a CRS
      // aggregates several (STP -> STPX | STPANCI | STPXBOX).
      sourceTiploc: sourceTpl,
      origin: j.origin,
      originName: resolve_.tiplocToName(j.origin),
      originCrs: resolve_.tiplocToCrs(j.origin),
      destination: j.destination,
      destinationName: resolve_.tiplocToName(j.destination),
      destinationCrs: resolve_.tiplocToCrs(j.destination),
      callingAfter,
      callingAfterNames: callingAfter.map(resolve_.tiplocToName),
      callingAfterCrs:   callingAfter.map(resolve_.tiplocToCrs),
      isPassenger: j.isPassenger,
      cancelled: cancelInfo ? true : false,
      cancellation: cancelInfo,
      delayReason: delayInfo,
      status: cancelInfo
        ? 'CANCELLED'
        : (bestKind === 'scheduled' || bestKind === 'working') ? 'on time'
        : `${bestKind} ${bestTime}`,
    });
  }
  rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return rows;
}

function buildSnapshot(tiplocs, windowHours, primaryTiploc) {
  const all = Array.isArray(tiplocs) ? tiplocs : [tiplocs];
  const primary = (primaryTiploc || all[0]).toUpperCase();
  const rows = buildDeparturesForTiplocs(all, windowHours);
  if (rows === null) return null;
  return {
    tiploc: primary,
    // When the station spans several TIPLOCs, expose the full set so the
    // caller (and the website) can see what's been merged.
    tiplocs: all.length > 1 ? all : undefined,
    stationName: resolve_.tiplocToName(primary),
    stationCrs:  resolve_.tiplocToCrs(primary),
    updatedAt: new Date().toISOString(),
    timetableFile: timetablePath.split('/').pop(),
    windowHours,
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

// ---------- CRS / TIPLOC resolution ---------------------------------------
function resolveStationCode(rawCode) {
  if (!rawCode) return null;
  const code = rawCode.toUpperCase();
  // If it's already a valid TIPLOC, use it directly.
  if (locations.has(code)) {
    const info = locations.get(code);
    return {
      tiploc: code,                  // primary
      tiplocs: [code],               // all (1)
      crs: info.crs,
      name: info.name || code,
      matchedAs: 'tiploc',
    };
  }
  // CRS lookup — a CRS can map to multiple TIPLOCs that ALL belong to the
  // same station (e.g. STP = STPX [plat 1-4] + STPANCI [plat 5-13] +
  // STPXBOX [Thameslink low-level plat A]). We aggregate departures across
  // all of them; the "primary" is just the one with the most services for
  // labelling purposes.
  const candidates = crsToTiplocs.get(code) || [];
  if (candidates.length === 0) return null;
  // Sort by service count desc so primary is candidates[0].
  const ranked = candidates
    .map((t) => ({ t, n: (byTiploc.get(t) || []).length }))
    .sort((a, b) => b.n - a.n)
    .map((x) => x.t);
  const primary = ranked[0];
  const info = locations.get(primary);
  return {
    tiploc: primary,
    tiplocs: ranked,                  // all (>= 1) — all aggregated by /api/departures
    crs: code,
    name: info?.name || primary,
    matchedAs: 'crs',
    alternates: ranked.length > 1 ? ranked.slice(1) : undefined,
  };
}

// ---------- service detail (full calling pattern) --------------------------
function buildServiceDetail(rid) {
  const j = byRid.get(rid);
  if (!j) return null;
  const ov = liveOverlayByRid.get(rid);
  const cancelInfo = cancelled.get(rid) || null;
  const delayInfo  = delayReason.get(rid) || null;

  const stops = j.slots.map((s) => {
    const live = ov?.locs?.get(s.tpl) || null;
    return {
      tpl: s.tpl,
      name: resolve_.tiplocToName(s.tpl),
      crs:  resolve_.tiplocToCrs(s.tpl),
      slot: s.slot,                          // OR / IP / PP / DT / OPxx
      pta:  s.pta,
      ptd:  s.ptd,
      wta:  s.wta,
      wtd:  s.wtd,
      wtp:  s.wtp,
      platform: s.plat,
      livePlatform: live?.livePlat || null,
      activity: s.act,
      liveTime: live?.bestTime || null,
      liveKind: live?.bestKind || null,
      cancelledAtStop: live?.cancelled || false,
    };
  });

  return {
    rid: j.rid,
    uid: j.uid,
    trainId: j.trainId,
    ssd: j.ssd,
    toc: j.toc,
    tocName: resolve_.tocToName(j.toc),
    trainCat: j.trainCat,
    isPassenger: j.isPassenger,
    origin: j.origin,
    originName: resolve_.tiplocToName(j.origin),
    destination: j.destination,
    destinationName: resolve_.tiplocToName(j.destination),
    cancelled: cancelInfo ? true : false,
    cancellation: cancelInfo,
    delayReason: delayInfo,
    stops,
    updatedAt: new Date().toISOString(),
  };
}

// ---------- HTTP server ----------------------------------------------------
function pickCorsOrigin(req) {
  if (cfg.corsOrigins.includes('*')) return '*';
  const origin = req.headers.origin;
  if (origin && cfg.corsOrigins.includes(origin)) return origin;
  return cfg.corsOrigins[0] || 'http://localhost:3000';
}
function sendJson(res, status, body, req) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': pickCorsOrigin(req),
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': pickCorsOrigin(req),
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method not allowed' }, req);
    return;
  }

  const url = new URL(req.url, `http://localhost:${cfg.port}`);
  const parts = url.pathname.split('/').filter(Boolean);

  // /api/health
  if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'health') {
    const mem = process.memoryUsage();
    sendJson(res, 200, {
      ok: true,
      tiplocsIndexed: byTiploc.size,
      journeysLoaded: byRid.size,
      timetableFile: timetablePath.split('/').pop(),
      loadedDate,
      kafka: stats,
      overlaySize: { live: liveOverlayByRid.size, cancelled: cancelled.size, delayed: delayReason.size },
      memoryMB: { heap: +(mem.heapUsed/1024/1024).toFixed(1), rss: +(mem.rss/1024/1024).toFixed(1) },
    }, req);
    return;
  }

  // /api/station/:code
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'station') {
    const resolved = resolveStationCode(parts[2]);
    if (!resolved) { sendJson(res, 404, { error: `unknown station code "${parts[2]}"` }, req); return; }
    sendJson(res, 200, resolved, req);
    return;
  }

  // /api/departures/:code?hours=N
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'departures') {
    const resolved = resolveStationCode(parts[2]);
    if (!resolved) { sendJson(res, 404, { error: `unknown station code "${parts[2]}"` }, req); return; }
    const hoursParam = url.searchParams.get('hours');
    const hours = Math.max(0.25, Math.min(24, Number(hoursParam || cfg.windowHours)));
    // Pass the FULL set of TIPLOCs that share this CRS so a station with
    // multiple platform groups (St Pancras, Edinburgh, etc.) returns all
    // its departures, not just one platform group.
    const snap = buildSnapshot(resolved.tiplocs, hours, resolved.tiploc);
    if (!snap) { sendJson(res, 404, { error: `no services indexed for ${resolved.tiploc}` }, req); return; }
    snap.stationName = resolved.name || snap.stationName;
    snap.stationCrs  = resolved.crs  || snap.stationCrs;
    snap.matchedAs   = resolved.matchedAs;
    if (resolved.alternates) snap.alternates = resolved.alternates;
    sendJson(res, 200, snap, req);
    return;
  }

  // /api/service/:rid
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'service') {
    const detail = buildServiceDetail(parts[2]);
    if (!detail) { sendJson(res, 404, { error: `rid not found: "${parts[2]}"` }, req); return; }
    sendJson(res, 200, detail, req);
    return;
  }

  sendJson(res, 404, { error: 'not found', hint: 'try /api/health, /api/station/:code, /api/departures/:code, /api/service/:rid' }, req);
}

const server = createServer(handleRequest);

// ---------- Kafka loop -----------------------------------------------------
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
  console.log('\n[daemon] shutting down ...');
  try { server.close(); } catch {}
  try { await consumer.disconnect(); } catch {}
  console.log('[daemon] bye.');
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  server.listen(cfg.port, () => {
    console.log(`[daemon] HTTP API listening on http://localhost:${cfg.port}`);
    console.log(`[daemon]   GET /api/health`);
    console.log(`[daemon]   GET /api/station/:code`);
    console.log(`[daemon]   GET /api/departures/:code?hours=N   (default ${cfg.windowHours})`);
    console.log(`[daemon]   GET /api/service/:rid`);
  });

  await consumer.connect();
  await consumer.subscribe({ topic: cfg.topic, fromBeginning: false });

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
      try { processMessage(pport); } catch { /* don't die on one bad message */ }
    },
  }).catch((e) => {
    console.error('[daemon] consumer.run error:', e);
    shutdown();
  });

  if (replayOffsets) {
    await new Promise((r) => setTimeout(r, 2000));
    for (const o of replayOffsets) {
      try { consumer.seek({ topic: cfg.topic, partition: o.partition, offset: o.offset }); }
      catch (e) { console.warn(`[daemon] seek p${o.partition} failed: ${e.message}`); }
    }
  }

  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[daemon] heartbeat: consumed=${stats.consumed} updates=${stats.updates} live=${liveOverlayByRid.size} cancelled=${cancelled.size} lastMsg=${stats.lastKafkaMsgAt || 'none'} heap=${(mem.heapUsed/1024/1024).toFixed(0)}MB`);
  }, cfg.heartbeat * 1000);

  // Day rollover: every 5 min, check the date.
  setInterval(() => {
    const t = todayYmd();
    if (t !== loadedDate) {
      console.log(`[daemon] day rollover detected (${loadedDate} → ${t}), reloading reference data ...`);
      try {
        reloadReferenceData();
        liveOverlayByRid.clear();
        cancelled.clear();
        delayReason.clear();
      } catch (e) {
        console.warn(`[daemon] reload failed (will retry in 5 min): ${e.message}`);
      }
    }
  }, 5 * 60_000);
}

start().catch((e) => { console.error('[daemon] fatal:', e); process.exit(1); });
