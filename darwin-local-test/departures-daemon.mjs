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
 *   GET  /api/messages/:crs
 *   GET  /api/service/:rid
 *   GET  /api/unit/:resourceGroupId   (PTAC unit / day diagram)
 *
 * Env vars (all optional except DARWIN_*):
 *   DAEMON_PORT            HTTP port (default 4001)
 *   CORS_ORIGIN            Access-Control-Allow-Origin (default http://localhost:5173)
 *   DEFAULT_WINDOW_HOURS   default look-ahead when ?hours is omitted (default 3)
 *   INITIAL_REPLAY_MIN     Kafka replay on startup (default 1080 = 18h, which
 *                          covers the overnight `scheduleFormations` broadcast
 *                          window so most services running today have their
 *                          formation cached on first request)
 *   HEARTBEAT_SEC          stats log interval (default 60)
 *   DARWIN_*               Kafka creds from .env
 */

import { readdirSync, readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { loadAllJourneysIndexedByTiploc } from './timetable-loader.mjs';
import { loadTodaysReasons } from './reasons-loader.mjs';
import { loadTodaysLocations, makeResolvers } from './locations-loader.mjs';
import { parseConsistMessage, consistJoinKey, KNOWN_PTAC_TOC } from './consist-parser.mjs';

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
  initialReplay:   Number(process.env.INITIAL_REPLAY_MIN || 1080),
  heartbeat:       Number(process.env.HEARTBEAT_SEC || 60),
};

// PTAC (S506) feed config — separate creds and consumer group from Darwin.
// All optional: if any are missing, the PTAC consumer is skipped silently.
const ptacCfg = {
  bootstrap:    process.env.PTAC_BOOTSTRAP || cfg.bootstrap,  // same Confluent cluster
  username:     process.env.PTAC_USERNAME,
  password:     process.env.PTAC_PASSWORD,
  topic:        process.env.PTAC_TOPIC || 'prod-1033-Passenger-Train-Allocation-and-Consist-1_0',
  groupId:      process.env.PTAC_GROUP_ID,
  initialReplay: Number(process.env.PTAC_INITIAL_REPLAY_MIN || 720),
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

/**
 * Flatten a fast-xml-parser-style mixed-content tree into plain text + a
 * naive HTML representation. NRCC `OW.Msg` arrives shaped like:
 *   { "": "leading text ", a: { href: "...", "": "link text" } }
 * or with multiple paragraphs:
 *   { p: ["para 1", "para 2"] }
 * The empty-string key holds bare text content; named keys are nested HTML
 * elements. Children may be objects, strings, or arrays. Iteration order on
 * a plain object is insertion order in V8, which matches XML reading order
 * for the cases observed in the wild.
 */
function flattenHtml(node) {
  if (node == null) return { plain: '', html: '' };
  if (typeof node === 'string' || typeof node === 'number') {
    const s = String(node);
    return { plain: s, html: s };
  }
  if (Array.isArray(node)) {
    let plain = '', html = '';
    for (const item of node) {
      const r = flattenHtml(item);
      // Separate array items with a space so adjacent paragraphs don't
      // smush into one word.
      plain += (plain && r.plain ? ' ' : '') + r.plain;
      html  += r.html;
    }
    return { plain, html };
  }
  if (typeof node === 'object') {
    let plain = '', html = '';
    for (const [key, val] of Object.entries(node)) {
      // Bare text content of this element (fast-xml-parser convention).
      if (key === '' || key === '#text' || key === '_') {
        const r = flattenHtml(val);
        plain += r.plain; html += r.html;
        continue;
      }
      // XML attributes: skip in the flattened text. The href etc. live
      // inside child elements; if we have an `a` with href it's already
      // an object and the href is processed below.
      if (typeof val !== 'object') {
        // Scalar attribute (e.g. on the parent) — ignore.
        continue;
      }
      const inner = flattenHtml(val);
      // Wrap recognised inline elements in real HTML. For `a` we also
      // pull the href out of the child object so links are clickable.
      if (key === 'a') {
        // val may be a single anchor object or an array of them.
        const anchors = Array.isArray(val) ? val : [val];
        for (const anc of anchors) {
          const href = anc && (anc.href || anc.HREF);
          const r    = flattenHtml(anc);
          if (href) html += `<a href="${escapeAttr(String(href))}" target="_blank" rel="noopener">${escapeText(r.plain)}</a>`;
          else      html += escapeText(r.plain);
          plain += r.plain;
        }
      } else if (key === 'br') {
        html  += '<br>';
        plain += '\n';
      } else if (key === 'p') {
        const r = flattenHtml(val);
        html  += `<p>${escapeText(r.plain)}</p>`;
        plain += (plain ? '\n\n' : '') + r.plain;
      } else if (key === 'b' || key === 'strong' || key === 'i' || key === 'em' || key === 'u' || key === 'span') {
        html  += `<${key}>${escapeText(inner.plain)}</${key}>`;
        plain += inner.plain;
      } else {
        // Unknown element: keep its text content but drop the wrapper.
        plain += inner.plain;
        html  += escapeText(inner.plain);
      }
    }
    return { plain, html };
  }
  return { plain: '', html: '' };
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}

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
// PTAC join key index built from byRid each reload.
//   "ssd|headcode|originTiploc|originHHMM" -> rid
// Plus a fallback "ssd|headcode|originTiploc" -> [rid, ...] for stop-time-only matches.
let ptacJoinByTuple, ptacJoinByOrigin;

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

  // Build the PTAC join index. Each Darwin journey gets two entries:
  //   1. A precise key (ssd, headcode, originTiploc, originHHMM) → rid
  //   2. A looser fallback (ssd, headcode, originTiploc) → [rids]
  // PTAC rarely sends seconds in its timestamps, but Darwin sometimes
  // publishes ptd as "HH:MM:30" so we trim to HH:MM before indexing.
  ptacJoinByTuple = new Map();
  ptacJoinByOrigin = new Map();
  for (const [rid, j] of byRid) {
    const origin = j.slots?.find((s) => s.slot === 'OR' || s.slot === 'OPOR');
    if (!origin?.tpl) continue;
    const time = (origin.ptd || origin.wtd || '').slice(0, 5);
    if (!j.trainId || !j.ssd) continue;
    const exact = `${j.ssd}|${j.trainId}|${origin.tpl}|${time}`;
    const loose = `${j.ssd}|${j.trainId}|${origin.tpl}`;
    ptacJoinByTuple.set(exact, rid);
    let arr = ptacJoinByOrigin.get(loose);
    if (!arr) { arr = []; ptacJoinByOrigin.set(loose, arr); }
    arr.push(rid);
  }

  loadedDate = todayYmd();
}

reloadReferenceData();

// ---------- live overlay state (keyed by RID, global) ----------------------
const liveOverlayByRid = new Map();   // rid -> { locs: Map<tpl, {ptd,pta,plat,...}>, latestTs }
const cancelled   = new Map();        // rid -> { reason, source, code? }
const delayReason = new Map();        // rid -> { reason, source, code? }
const reverseFormation = new Set();   // rids known to run with reversed coach order
// uR.scheduleFormations — maps RID to its formation { fid, coaches: [{coachNumber, coachClass}] }.
// Long-lived (one per service per day); a service may also be re-formed mid-day so
// later messages overwrite earlier.
const formationsByRid = new Map();    // rid -> { fid, coaches: [{number, class}] }
// uR.serviceLoading — overall load %, set on the per-TIPLOC overlay entry.
// uR.formationLoading — per-coach load values; stashed on the overlay entry too.
// Both decay naturally with the live overlay map.

// uR.OW — Operational Warning (NRCC station messages). Indexed by CRS so a
// board lookup is O(1). Each message is referenced by every CRS it lists.
const stationMessages = new Map();    // crs -> Set<id>
const messagesById    = new Map();    // id  -> { id, severity, category, htmlMessage, plainMessage, stations: [crs], suppress }

// uR.association — service joins/divides/next-portion. Keyed by main RID and
// (mirrored) by associated RID so either side can look up.
const associationsByRid = new Map();  // rid -> Array<{ category, mainRid, assocRid, tiploc, ... }>

// uR.trainAlert — short text alerts per service.
const alertsByRid = new Map();        // rid -> Array<{ id, type, audience, text, source, locations }>

// ---------- PTAC (S506 Passenger Train Allocation and Consist) state ------
// Each PTAC message describes one train's physical formation (which units,
// vehicles, defects, etc.). Keyed by Darwin RID after the (ssd, headcode,
// originTpl, originHHMM) join.
const consistByRid = new Map();       // rid -> { allocations: [...], parsedAt, ptacCompany, sourceCore }
// Unit-tracking index: which RIDs has this physical unit worked today, in
// chronological order. Useful for the "follow this unit" page.
const unitsById    = new Map();       // unitId -> { fleetId, vehicles, lastSeenRid, services: [{rid, start, end, headcode}], updatedAt }
// Stash messages we couldn't immediately match — they may match after the
// next timetable reload (overnight services published before midnight).
// Keyed by the join tuple; value is the parsed message. Bounded to avoid
// unbounded growth on a sustained mismatch.
const unmatchedConsists = new Map();  // "ssd|headcode|tpl|hhmm" -> parsed
const PTAC_UNMATCHED_CAP = 5000;

const stats = {
  consumed: 0,
  updates:  0,
  startedAt: new Date().toISOString(),
  lastKafkaMsgAt: null,
};

// ---------- persistence ---------------------------------------------------
// Long-lived caches (formations, station messages, associations, alerts,
// reverseFormation) accumulate slowly because Darwin only broadcasts each
// piece of data once per service per day. Confluent's broker retention is
// shorter than a day, so a daemon restart wipes a lot of useful state. We
// persist these caches to disk every PERSIST_INTERVAL_SEC and on graceful
// shutdown, then reload them on startup. Live overlays (forecasts, actuals,
// platform changes) are *not* persisted — they're high-churn and Darwin
// rebroadcasts them frequently.
const STATE_DIR  = resolve(__dirname, 'state');
const STATE_FILE = resolve(STATE_DIR, 'daemon-cache.json');
const PERSIST_INTERVAL_SEC = Number(process.env.PERSIST_INTERVAL_SEC || 30);
let lastPersistAt = null;

function loadPersistedState() {
  if (!existsSync(STATE_FILE)) {
    console.log(`[daemon] no persisted state at ${STATE_FILE} — starting fresh.`);
    return;
  }
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    // Stale guard: if the file is from a previous operating day, drop it.
    // A "day" here is the daemon's local YMD, matching reloadReferenceData().
    if (raw.savedDate && raw.savedDate !== todayYmd()) {
      console.log(`[daemon] persisted state is from ${raw.savedDate}, today is ${todayYmd()} — discarding.`);
      return;
    }
    if (raw.formations)        for (const [k, v] of raw.formations)        formationsByRid.set(k, v);
    if (raw.messagesById) {
      let dropped = 0;
      for (const [k, v] of raw.messagesById) {
        // Old cache entries may have lost link text from their plainMessage
        // (the previous flattener didn't walk into nested anchor objects).
        // Tidy up dangling ",.", ",," that came from that bug so the UI
        // doesn't render "can be found in ,." until Darwin re-broadcasts.
        if (v?.plainMessage)
          v.plainMessage = v.plainMessage.replace(/\s*[,;]+\s*\.?\s*$/, '.').replace(/\s+/g, ' ').trim();
        // Drop entries with no usable text — they were broken by the old
        // flattener and will be re-populated correctly when NRCC re-issues.
        if (!v?.plainMessage || v.plainMessage.length < 3) { dropped++; continue; }
        messagesById.set(k, v);
      }
      if (dropped) console.log(`[daemon] dropped ${dropped} empty/broken cached messages from previous flattener.`);
    }
    if (raw.stationMessages)   for (const [k, v] of raw.stationMessages)   stationMessages.set(k, new Set(v));
    if (raw.associations)      for (const [k, v] of raw.associations)      associationsByRid.set(k, v);
    if (raw.alerts)            for (const [k, v] of raw.alerts)            alertsByRid.set(k, v);
    if (raw.reverseFormation)  for (const r of raw.reverseFormation)       reverseFormation.add(r);
    if (raw.consistByRid) for (const [k, v] of raw.consistByRid) consistByRid.set(k, v);
    if (raw.unitsById)    for (const [k, v] of raw.unitsById)    unitsById.set(k, v);
    if (raw.unmatchedConsists) for (const [k, v] of raw.unmatchedConsists) unmatchedConsists.set(k, v);
    console.log(
      `[daemon] restored persisted state: ${formationsByRid.size} formations, `
      + `${consistByRid.size} consists, ${unitsById.size} units, `
      + `${messagesById.size} messages, ${associationsByRid.size} associations, `
      + `${alertsByRid.size} alerted services, ${reverseFormation.size} reverse formations.`
    );
  } catch (e) {
    console.warn(`[daemon] failed to load persisted state: ${e.message}`);
  }
}

function persistState() {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    const payload = {
      savedAt:   new Date().toISOString(),
      savedDate: todayYmd(),
      // Convert Maps/Sets to JSON-serialisable arrays. Use [[k,v], ...] format
      // for Maps so order is preserved on round-trip.
      formations:       [...formationsByRid.entries()],
      messagesById:     [...messagesById.entries()],
      stationMessages:  [...stationMessages.entries()].map(([k, v]) => [k, [...v]]),
      associations:     [...associationsByRid.entries()],
      alerts:           [...alertsByRid.entries()],
      reverseFormation: [...reverseFormation],
      // PTAC caches — biggest entries, but together still <10 MB JSON.
      consistByRid:     [...consistByRid.entries()],
      unitsById:        [...unitsById.entries()],
      unmatchedConsists: [...unmatchedConsists.entries()],
    };
    // Atomic write: write to a tmp file, then rename. Avoids leaving a
    // half-written cache on disk if the process crashes mid-flush.
    const tmp = STATE_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(payload));
    renameSync(tmp, STATE_FILE);
    lastPersistAt = new Date().toISOString();
  } catch (e) {
    console.warn(`[daemon] failed to persist state: ${e.message}`);
  }
}

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

      // Reverse-formation flag (e.g. when a unit runs the wrong way round; the
      // platform numbering of carriages is mirrored). Useful for the future
      // formation-aware UI: passenger asking "which end is coach 1?".
      if (ts.isReverseFormation === 'true' || ts.isReverseFormation === true) reverseFormation.add(ts.rid);
      else if (ts.isReverseFormation === 'false' || ts.isReverseFormation === false) reverseFormation.delete(ts.rid);

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
        // PARTIAL CANCELLATION semantics: a `can="true"` or `cancelReason`
        // attribute on a single Location means *just this stop* is cancelled
        // (e.g. service runs A→B but is cancelled B→F). Do NOT promote that
        // to a whole-service cancellation; the board/detail responses derive
        // per-stop status from entry.cancelled and per-stop cancelReason.
        if (loc.can === 'true' || loc.can === true) {
          entry.cancelled = true;
          stats.updates++;
        }
        if (loc.lateReason) {
          const code = String(unwrap(loc.lateReason));
          delayReason.set(ts.rid, { code, source: 'ts-loc', reason: lateReasons.get(code) || `code ${code}` });
          stats.updates++;
        }
        if (loc.cancelReason) {
          const code = String(unwrap(loc.cancelReason));
          entry.cancelled    = true;
          entry.cancelReason = { code, reason: cancelReasons.get(code) || `code ${code}` };
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
        for (const node of asArray(sc[k])) {
          // Same partial-cancellation rule as the TS branch: per-stop
          // cancelled flags don't cancel the whole service, only that stop.
          if (node?.cancelled === 'true' || node?.can === 'true') {
            const tpl = unwrap(node?.tpl);
            if (tpl) {
              const ov = getOverlay(sc.rid);
              let entry = ov.locs.get(tpl);
              if (!entry) { entry = {}; ov.locs.set(tpl, entry); }
              entry.cancelled = true;
              stats.updates++;
            }
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

    // --- serviceLoading (overall passenger load % at a stop) ----------------
    // {rid, tpl, wta/wtd/pta/ptd, loadingPercentage:"61"}
    for (const sl of asArray(e.serviceLoading)) {
      if (!sl?.rid || !sl.tpl) continue;
      const ov = getOverlay(sl.rid);
      const tpl = String(sl.tpl).toUpperCase();
      let entry = ov.locs.get(tpl);
      if (!entry) { entry = {}; ov.locs.set(tpl, entry); }
      const pct = Number(unwrap(sl.loadingPercentage));
      if (Number.isFinite(pct)) { entry.loadPct = pct; stats.updates++; }
    }

    // --- formationLoading (per-coach load values at a stop) -----------------
    // {fid, rid, tpl, ..., loading:[{coachNumber, "":"7"}, ...]}
    // Loading values appear to be 1–10 enum (1 = empty, 10 = full) per the
    // Darwin spec; we pass them through as-is so the UI can decide.
    for (const fl of asArray(e.formationLoading)) {
      if (!fl?.rid || !fl.tpl) continue;
      const ov = getOverlay(fl.rid);
      const tpl = String(fl.tpl).toUpperCase();
      let entry = ov.locs.get(tpl);
      if (!entry) { entry = {}; ov.locs.set(tpl, entry); }
      entry.fid = String(unwrap(fl.fid) || '');
      entry.coachLoading = asArray(fl.loading).map((c) => ({
        number: String(unwrap(c.coachNumber) || ''),
        value:  Number(unwrap(c['']) ?? unwrap(c['#text']) ?? unwrap(c._)),
      })).filter((c) => c.number);
      stats.updates++;
    }

    // --- scheduleFormations (coach list + class for an FID) -----------------
    // {rid, formation:{fid, coaches:{coach:[{coachNumber, coachClass}]}}}
    for (const sf of asArray(e.scheduleFormations)) {
      if (!sf?.rid) continue;
      const f = sf.formation || {};
      const fid = String(unwrap(f.fid) || '');
      const coaches = asArray(f.coaches?.coach || f.coach).map((c) => ({
        number: String(unwrap(c.coachNumber) || ''),
        class:  String(unwrap(c.coachClass)  || ''),
        // Optional Darwin attrs we pass through if present.
        toilet:        c.toilet     ? String(unwrap(c.toilet))     : null,
        catering:      c.catering   ? String(unwrap(c.catering))   : null,
      }));
      formationsByRid.set(sf.rid, { fid, coaches });
      stats.updates++;
    }

    // --- association (service joins / divides / next-portion) ---------------
    // {tiploc, category:"VV"|"JJ"|"NP", main:{rid, wtd/ptd...}, assoc:{rid,...}, isCancelled?, isDeleted?}
    // Categories: JJ=join, VV=divide, NP=next-portion. We index on BOTH RIDs
    // so either side of the relationship can find the other.
    for (const a of asArray(e.association)) {
      const tiploc = String(unwrap(a.tiploc) || '').toUpperCase();
      const category = String(unwrap(a.category) || '');
      const main = a.main || {};
      const assoc = a.assoc || {};
      const mainRid  = String(unwrap(main.rid)  || '');
      const assocRid = String(unwrap(assoc.rid) || '');
      if (!mainRid || !assocRid) continue;
      const isDeleted = a.isDeleted === 'true' || a.isDeleted === true;
      const isCancelled = a.isCancelled === 'true' || a.isCancelled === true;
      const record = {
        category, tiploc, mainRid, assocRid, isCancelled, isDeleted,
        mainTime:  unwrap(main.ptd)  || unwrap(main.wtd)  || unwrap(main.pta)  || unwrap(main.wta)  || null,
        assocTime: unwrap(assoc.ptd) || unwrap(assoc.wtd) || unwrap(assoc.pta) || unwrap(assoc.wta) || null,
      };
      if (isDeleted) {
        // Withdraw any existing association between this pair at this tiploc.
        for (const rid of [mainRid, assocRid]) {
          const arr = associationsByRid.get(rid);
          if (!arr) continue;
          const left = arr.filter((x) => !(x.tiploc === tiploc && x.mainRid === mainRid && x.assocRid === assocRid));
          if (left.length) associationsByRid.set(rid, left);
          else associationsByRid.delete(rid);
        }
      } else {
        for (const rid of [mainRid, assocRid]) {
          const arr = associationsByRid.get(rid) || [];
          // Replace any existing record for the same tiploc+pair.
          const filtered = arr.filter((x) => !(x.tiploc === tiploc && x.mainRid === mainRid && x.assocRid === assocRid));
          filtered.push(record);
          associationsByRid.set(rid, filtered);
        }
      }
      stats.updates++;
    }

    // --- OW (Operational Warning / NRCC station message) -------------------
    // {id, cat, sev:"0"-"3", suppress?, Station:[{crs}], Msg:"<html...>"}
    // Severity levels: 0=info, 1=minor, 2=major, 3=severe.
    // Setting Station to empty or sev to deletion-equivalent isn't standardised;
    // these messages are typically refreshed by being re-broadcast or removed
    // by NRCC choosing not to mention them again. We expire stale ones via TTL.
    for (const ow of asArray(e.OW)) {
      const id = String(unwrap(ow.id) || '');
      if (!id) continue;
      const stations = asArray(ow.Station).map((s) => String(unwrap(s.crs) || '').toUpperCase()).filter(Boolean);
      const severity = Number(unwrap(ow.sev) ?? 0);
      const category = String(unwrap(ow.cat) || '');
      const suppress = ow.suppress === 'true' || ow.suppress === true;
      // Msg comes as a tree (mixed text + nested anchor / paragraph elements
      // courtesy of the JSON serializer). Walk the tree to recover both a
      // plain-text variant and a sanitised HTML one with clickable links.
      const flat  = flattenHtml(ow.Msg);
      const plain = flat.plain.replace(/\s+/g, ' ').trim();
      const html  = flat.html.replace(/\s+/g, ' ').trim();
      // Drop any prior CRS associations (the message might cover a different list now).
      const prior = messagesById.get(id);
      if (prior) for (const c of prior.stations) stationMessages.get(c)?.delete(id);
      // An empty plain text means the flattener couldn't recover anything
      // useful from this Msg shape — usually a malformed broadcast or a
      // structure we don't know about yet. Suppress rather than show a
      // blank banner; if NRCC re-issues with proper content we'll catch it.
      if (suppress || stations.length === 0 || !plain || plain.length < 3) {
        messagesById.delete(id);
      } else {
        messagesById.set(id, { id, severity, category, htmlMessage: html, plainMessage: plain, stations, receivedAt: new Date().toISOString() });
        for (const c of stations) {
          let set = stationMessages.get(c);
          if (!set) { set = new Set(); stationMessages.set(c, set); }
          set.add(id);
        }
      }
      stats.updates++;
    }

    // --- trainAlert (per-service free-text alert) --------------------------
    // {AlertID, AlertServices:{AlertService:{RID,...}}, AlertText, AlertType, Audience, Source}
    for (const al of asArray(e.trainAlert)) {
      const id = String(unwrap(al.AlertID) || '');
      if (!id) continue;
      const text = String(unwrap(al.AlertText) || '').trim();
      const type = String(unwrap(al.AlertType) || '');
      const audience = String(unwrap(al.Audience) || '');
      const source = String(unwrap(al.Source) || '');
      const services = asArray(al.AlertServices?.AlertService || al.AlertService);
      for (const svc of services) {
        const rid = String(unwrap(svc.RID) || '');
        if (!rid) continue;
        const locations = asArray(svc.Location).map((l) => String(unwrap(l) || '').toUpperCase()).filter(Boolean);
        const arr = alertsByRid.get(rid) || [];
        // Deduplicate by alert id; replace any prior copy.
        const filtered = arr.filter((x) => x.id !== id);
        filtered.push({ id, type, audience, source, text, locations });
        alertsByRid.set(rid, filtered);
        stats.updates++;
      }
    }
  }
}

// ---------- PTAC ingestion -------------------------------------------------
const ptacStats = {
  consumed: 0,
  parsed:   0,
  matched:  0,
  unmatched: 0,
  errors:   0,
  startedAt: null,
  lastMessageAt: null,
};

/**
 * Process a single raw PTAC XML message off the Kafka topic. We:
 *   1. Parse the XML to a normalised JS object.
 *   2. Resolve to a Darwin RID via the (ssd, headcode, originTpl, originHHMM) join.
 *   3. Store the consist by RID (latest broadcast wins).
 *   4. Update the unit-tracking index.
 * Unmatched messages are stashed in case a timetable reload later resolves them.
 */
function processConsistMessage(rawXml) {
  ptacStats.consumed++;
  ptacStats.lastMessageAt = new Date().toISOString();
  let parsed;
  try { parsed = parseConsistMessage(rawXml); }
  catch (e) { ptacStats.errors++; return; }
  if (!parsed) { ptacStats.errors++; return; }
  ptacStats.parsed++;

  // Empty messages = "remove allocation"; nothing to record but we should
  // still drop any prior consist for this train if we can match it.
  if (!parsed.allocations || parsed.allocations.length === 0) return;

  const key = consistJoinKey(parsed);
  if (!key) { ptacStats.unmatched++; return; }

  const exact = `${key.ssd}|${key.headcode}|${key.originTpl}|${key.originHHMM}`;
  const loose = `${key.ssd}|${key.headcode}|${key.originTpl}`;

  let rid = ptacJoinByTuple?.get(exact);
  if (!rid) {
    // Fall back to (ssd, headcode, originTpl) — disambiguate by picking the
    // candidate whose origin time is closest to PTAC's HHMM (in minutes).
    const cands = ptacJoinByOrigin?.get(loose) || [];
    if (cands.length === 1) rid = cands[0];
    else if (cands.length > 1) {
      const target = parseHHMM(key.originHHMM);
      let best = null, bestDelta = Infinity;
      for (const r of cands) {
        const j = byRid.get(r);
        const o = j?.slots?.find((s) => s.slot === 'OR' || s.slot === 'OPOR');
        const t = parseHHMM((o?.ptd || o?.wtd || '').slice(0, 5));
        if (target == null || t == null) continue;
        const delta = Math.abs(t - target);
        if (delta < bestDelta) { bestDelta = delta; best = r; }
      }
      if (best && bestDelta <= 5) rid = best;
    }
  }

  if (!rid) {
    // Stash for later resolution — bounded to prevent unbounded growth.
    if (unmatchedConsists.size >= PTAC_UNMATCHED_CAP) {
      // Drop the oldest entry (Maps iterate in insertion order).
      const firstKey = unmatchedConsists.keys().next().value;
      if (firstKey) unmatchedConsists.delete(firstKey);
    }
    unmatchedConsists.set(exact, parsed);
    ptacStats.unmatched++;
    return;
  }

  ptacStats.matched++;
  applyConsistToRid(rid, parsed);
}

/**
 * Convert a HH:MM string into minutes since midnight; returns null on bad input.
 */
function parseHHMM(s) {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Store the consist against a RID and update the unit-tracking index.
 * Always overwrites — latest broadcast wins, per the spec's "delete and
 * replace" semantics for repeated messages on the same train.
 */
function applyConsistToRid(rid, parsed) {
  consistByRid.set(rid, {
    parsedAt:     new Date().toISOString(),
    company:      parsed.company,
    companyDarwin: parsed.companyDarwin,
    core:         parsed.core,
    diagramDate:  parsed.allocations[0]?.diagramDate || null,
    allocations:  parsed.allocations,
  });

  // Refresh the unit-tracking index. Each unit (ResourceGroupId) gets a
  // record of every service it's been seen on today.
  const seenUnits = new Set();
  for (const a of parsed.allocations) {
    for (const rg of a.resourceGroups || []) {
      if (!rg.unitId || seenUnits.has(rg.unitId)) continue;
      seenUnits.add(rg.unitId);
      let entry = unitsById.get(rg.unitId);
      if (!entry) {
        entry = { unitId: rg.unitId, fleetId: rg.fleetId, vehicles: rg.vehicles, services: [] };
        unitsById.set(rg.unitId, entry);
      } else {
        // Refresh fleet + vehicles in case formation changed mid-day.
        entry.fleetId = rg.fleetId || entry.fleetId;
        entry.vehicles = rg.vehicles;
      }
      // Replace any existing service entry for this RID.
      entry.services = entry.services.filter((s) => s.rid !== rid);
      entry.services.push({
        rid,
        start: a.allocationOriginDateTime || a.trainOriginDateTime || null,
        end:   a.allocationDestinationDateTime || a.trainDestDateTime || null,
        startTpl: a.allocationOrigin?.tiploc || a.trainOrigin?.tiploc || null,
        endTpl:   a.allocationDestination?.tiploc || a.trainDest?.tiploc || null,
        headcode: parsed.headcode,
        position: a.resourceGroupPosition,
        reversed: a.reversed,
      });
      entry.services.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
      entry.lastSeenRid = rid;
      entry.updatedAt   = new Date().toISOString();
    }
  }
}

/**
 * After a timetable reload, retry unmatched PTAC messages — overnight
 * services published before the rollover may now resolve to a fresh RID.
 */
function retryUnmatchedConsists() {
  if (unmatchedConsists.size === 0) return 0;
  let resolved = 0;
  for (const [k, parsed] of [...unmatchedConsists]) {
    const key = consistJoinKey(parsed);
    if (!key) continue;
    const rid = ptacJoinByTuple?.get(`${key.ssd}|${key.headcode}|${key.originTpl}|${key.originHHMM}`);
    if (rid) {
      applyConsistToRid(rid, parsed);
      unmatchedConsists.delete(k);
      resolved++;
    }
  }
  return resolved;
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

    // Effective cancellation seen by *this row*: a row is cancelled if the
    // whole service is cancelled OR this individual calling point is
    // cancelled (partial cancellation, e.g. service runs A→B but is
    // cancelled B→F — for stops in B→F the train won't appear).
    const wholeCancel = cancelled.get(rid) || null;
    const stopCancel  = liveLoc?.cancelled
      ? (liveLoc.cancelReason
          ? { ...liveLoc.cancelReason, source: 'ts-loc', scope: 'stop' }
          : { reason: 'Cancelled at this stop', source: 'ts-loc', scope: 'stop' })
      : null;
    const cancelInfo  = wholeCancel || stopCancel;
    const delayInfo   = delayReason.get(rid) || null;

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
      // Loading at this stop, when published. loadPct is 0-100;
      // coachLoading is 1-10 enum per coach.
      loadingPercentage: liveLoc?.loadPct ?? null,
      coachLoading: liveLoc?.coachLoading ?? null,
      reverseFormation: reverseFormation.has(rid),
      hasAssociations: (associationsByRid.get(rid)?.length ?? 0) > 0,
      hasAlerts:       (alertsByRid.get(rid)?.length ?? 0) > 0,
      hasConsist:      consistByRid.has(rid),
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

// All currently-known NRCC messages for a CRS, freshest first within each
// severity bucket so the UI can pick a representative one for a banner.
function listMessagesForCrs(crs) {
  const ids = stationMessages.get(String(crs).toUpperCase());
  if (!ids || ids.size === 0) return [];
  const out = [];
  for (const id of ids) {
    const m = messagesById.get(id);
    if (m) out.push(m);
  }
  out.sort((a, b) => (b.severity - a.severity) || b.receivedAt.localeCompare(a.receivedAt));
  return out;
}

function buildSnapshot(tiplocs, windowHours, primaryTiploc) {
  const all = Array.isArray(tiplocs) ? tiplocs : [tiplocs];
  const primary = (primaryTiploc || all[0]).toUpperCase();
  const rows = buildDeparturesForTiplocs(all, windowHours);
  if (rows === null) return null;
  const stationCrs = resolve_.tiplocToCrs(primary);
  const messages = stationCrs ? listMessagesForCrs(stationCrs) : [];
  return {
    tiploc: primary,
    // When the station spans several TIPLOCs, expose the full set so the
    // caller (and the website) can see what's been merged.
    tiplocs: all.length > 1 ? all : undefined,
    stationName: resolve_.tiplocToName(primary),
    stationCrs,
    updatedAt: new Date().toISOString(),
    timetableFile: timetablePath.split('/').pop(),
    windowHours,
    counts: {
      departures: rows.length,
      cancelled:  rows.filter((r) => r.cancelled).length,
      withDelay:  rows.filter((r) => r.delayReason).length,
      messages:   messages.length,
    },
    messages,
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
      cancelReasonAtStop: live?.cancelReason || null,
      // Loading at this stop (if Darwin published it): overall % and/or
      // per-coach 1–10 enum. Null means no live loading data yet.
      loadingPercentage: live?.loadPct ?? null,
      coachLoading: live?.coachLoading ?? null,
    };
  });

  // A "partial cancellation" is when the whole service isn't cancelled but
  // one or more individual stops are. The UI uses this to show a banner
  // explaining the situation alongside per-stop strikethroughs.
  const partiallyCancelled = !cancelInfo && stops.some((s) => s.cancelledAtStop);

  // Resolve associated services to human-readable summaries. We only look up
  // basic info on the *other* RID — full traversal can be done by the client
  // by following the RID into another /api/service/:rid call.
  const associations = (associationsByRid.get(rid) || []).map((a) => {
    const otherRid = a.mainRid === rid ? a.assocRid : a.mainRid;
    const other = byRid.get(otherRid);
    return {
      ...a,
      role: a.mainRid === rid ? 'main' : 'associated',
      otherRid,
      otherTrainId: other?.trainId || null,
      otherToc: other?.toc || null,
      otherOriginName:      other ? resolve_.tiplocToName(other.origin) : null,
      otherDestinationName: other ? resolve_.tiplocToName(other.destination) : null,
      tiplocName: resolve_.tiplocToName(a.tiploc),
      tiplocCrs:  resolve_.tiplocToCrs(a.tiploc),
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
    partiallyCancelled,
    delayReason: delayInfo,
    reverseFormation: reverseFormation.has(rid),
    formation:    formationsByRid.get(rid) || null,
    // PTAC consist (physical reality view): unit numbers, vehicles, defects,
    // class identification. Null when no PTAC message has been received for
    // this RID yet (most regional services + LNER don't publish to PTAC).
    consist:      consistByRid.get(rid) || null,
    associations,
    alerts:       alertsByRid.get(rid) || [],
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
      overlaySize: {
        live: liveOverlayByRid.size,
        cancelled: cancelled.size,
        delayed: delayReason.size,
        formations: formationsByRid.size,
        stationsWithMessages: stationMessages.size,
        messages: messagesById.size,
        ridsWithAssociations: associationsByRid.size,
        ridsWithAlerts: alertsByRid.size,
        reverseFormation: reverseFormation.size,
        // PTAC (S506) consist & unit caches
        consists: consistByRid.size,
        units: unitsById.size,
        unmatchedConsists: unmatchedConsists.size,
      },
      ptac: {
        enabled: !!(ptacCfg.username && ptacCfg.groupId),
        topic: ptacCfg.topic,
        ...ptacStats,
      },
      memoryMB: { heap: +(mem.heapUsed/1024/1024).toFixed(1), rss: +(mem.rss/1024/1024).toFixed(1) },
      persistence: { stateFile: STATE_FILE, intervalSec: PERSIST_INTERVAL_SEC, lastPersistAt },
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

  // /api/messages/:crs — currently-known NRCC station messages for that CRS.
  // Falls through to 200 with empty list if the CRS is unknown so the UI can
  // call this freely without 404 noise.
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'messages') {
    const crs = parts[2].toUpperCase();
    const messages = listMessagesForCrs(crs);
    sendJson(res, 200, { crs, messages, count: messages.length, updatedAt: new Date().toISOString() }, req);
    return;
  }

  // /api/service/:rid
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'service') {
    const detail = buildServiceDetail(parts[2]);
    if (!detail) { sendJson(res, 404, { error: `rid not found: "${parts[2]}"` }, req); return; }
    sendJson(res, 200, detail, req);
    return;
  }

  // /api/unit/:resourceGroupId — physical unit detail + day's diagram
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'unit') {
    const unit = unitsById.get(parts[2]);
    if (!unit) { sendJson(res, 404, { error: `unit not seen today: "${parts[2]}"` }, req); return; }
    // Enrich each service entry with friendly origin/destination names.
    const services = (unit.services || []).map((s) => ({
      ...s,
      startName: s.startTpl ? resolve_.tiplocToName(s.startTpl) : null,
      endName:   s.endTpl   ? resolve_.tiplocToName(s.endTpl)   : null,
    }));
    sendJson(res, 200, { ...unit, services, updatedAt: new Date().toISOString() }, req);
    return;
  }

  sendJson(res, 404, { error: 'not found', hint: 'try /api/health, /api/station/:code, /api/departures/:code, /api/messages/:crs, /api/service/:rid, /api/unit/:id' }, req);
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

// PTAC consumer — separate Kafka client (different SASL credentials) on the
// same Confluent cluster. Created lazily inside startPtacConsumer() so it
// is silently skipped when the PTAC creds aren't set in .env.
let ptacKafka = null;
let ptacConsumer = null;

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[daemon] shutting down ...');
  try { server.close(); } catch {}
  try { await consumer.disconnect(); } catch {}
  if (ptacConsumer) try { await ptacConsumer.disconnect(); } catch {}
  // Final flush so the latest accumulated state survives the restart.
  console.log('[daemon] persisting final state ...');
  persistState();
  console.log('[daemon] bye.');
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

/**
 * Spin up the PTAC consumer alongside Darwin. Silent no-op if PTAC creds
 * are missing — Darwin still works fine without it. Failures here log a
 * warning but don't crash the process; the daemon should keep serving
 * Darwin data even if Network Rail's feed is unreachable.
 */
async function startPtacConsumer() {
  if (!ptacCfg.username || !ptacCfg.password || !ptacCfg.groupId) {
    console.log('[ptac] disabled: missing PTAC_USERNAME / PTAC_PASSWORD / PTAC_GROUP_ID in .env');
    return;
  }
  ptacStats.startedAt = new Date().toISOString();
  ptacKafka = new Kafka({
    clientId: 'rs-departures-daemon-ptac',
    brokers:  [ptacCfg.bootstrap], ssl: true,
    sasl:     { mechanism: 'plain', username: ptacCfg.username, password: ptacCfg.password },
    connectionTimeout: 15000,
    authenticationTimeout: 15000,
    logLevel: logLevel.WARN,
  });
  ptacConsumer = ptacKafka.consumer({ groupId: ptacCfg.groupId });

  try {
    await ptacConsumer.connect();
    await ptacConsumer.subscribe({ topic: ptacCfg.topic, fromBeginning: false });
  } catch (e) {
    console.warn(`[ptac] connect failed: ${e.message} — feed disabled.`);
    ptacConsumer = null;
    return;
  }

  // Replay window — same pattern as Darwin: fetch offsets corresponding to
  // (now − initialReplay) so a fresh start picks up the broker's full
  // retention without reprocessing already-consumed data.
  let replayOffsets = null;
  if (ptacCfg.initialReplay > 0) {
    const admin = ptacKafka.admin();
    try {
      await admin.connect();
      const sinceMs = Date.now() - ptacCfg.initialReplay * 60_000;
      replayOffsets = await admin.fetchTopicOffsetsByTimestamp(ptacCfg.topic, sinceMs);
      console.log(`[ptac] will replay -${ptacCfg.initialReplay} min across ${replayOffsets.length} partition(s).`);
    } catch (e) { console.warn(`[ptac] offset fetch failed: ${e.message}`); }
    finally { await admin.disconnect(); }
  }

  ptacConsumer.run({
    eachMessage: async ({ message }) => {
      try { processConsistMessage(message.value); }
      catch (e) { /* don't die on one bad message */ ptacStats.errors++; }
    },
  }).catch((e) => {
    console.error('[ptac] consumer.run error:', e);
    // Don't shutdown — keep Darwin running even if PTAC dies.
    ptacConsumer = null;
  });

  if (replayOffsets) {
    await new Promise((r) => setTimeout(r, 2000));
    for (const o of replayOffsets) {
      try { ptacConsumer.seek({ topic: ptacCfg.topic, partition: o.partition, offset: o.offset }); }
      catch (e) { console.warn(`[ptac] seek p${o.partition} failed: ${e.message}`); }
    }
  }

  console.log('[ptac] consumer running.');
}

async function start() {
  // Restore long-lived caches from the previous run *before* any messages are
  // processed, so live updates can immediately layer on top of yesterday's
  // formations / station messages / associations. Stale-day check happens
  // inside loadPersistedState().
  loadPersistedState();

  server.listen(cfg.port, () => {
    console.log(`[daemon] HTTP API listening on http://localhost:${cfg.port}`);
    console.log(`[daemon]   GET /api/health`);
    console.log(`[daemon]   GET /api/station/:code`);
    console.log(`[daemon]   GET /api/departures/:code?hours=N   (default ${cfg.windowHours})`);
    console.log(`[daemon]   GET /api/messages/:crs`);
    console.log(`[daemon]   GET /api/service/:rid`);
    console.log(`[daemon]   GET /api/unit/:resourceGroupId`);
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

  // Spin up the PTAC consumer in parallel. Fire-and-forget — its own
  // failures are isolated and won't bring Darwin down.
  startPtacConsumer().catch((e) => console.warn('[ptac] start failed:', e.message));

  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(
      `[daemon] heartbeat: darwin consumed=${stats.consumed} updates=${stats.updates} live=${liveOverlayByRid.size} cancelled=${cancelled.size} formations=${formationsByRid.size}`
      + ` | ptac consumed=${ptacStats.consumed} matched=${ptacStats.matched} unmatched=${unmatchedConsists.size} consists=${consistByRid.size} units=${unitsById.size}`
      + ` | heap=${(mem.heapUsed/1024/1024).toFixed(0)}MB`
    );
  }, cfg.heartbeat * 1000);

  // Persist long-lived caches on a regular timer so a crash or kill -9 still
  // leaves us at most PERSIST_INTERVAL_SEC of new data behind.
  setInterval(persistState, PERSIST_INTERVAL_SEC * 1000);

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
        reverseFormation.clear();
        formationsByRid.clear();
        stationMessages.clear();
        messagesById.clear();
        associationsByRid.clear();
        alertsByRid.clear();
        consistByRid.clear();
        unitsById.clear();
        unmatchedConsists.clear();
        // Flush the now-empty caches to disk straight away so an immediate
        // restart doesn't re-load yesterday's data through the stale-day
        // guard race window.
        persistState();
      } catch (e) {
        console.warn(`[daemon] reload failed (will retry in 5 min): ${e.message}`);
      }
    }
  }, 5 * 60_000);
}

start().catch((e) => { console.error('[daemon] fatal:', e); process.exit(1); });
