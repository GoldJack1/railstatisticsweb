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
 *   GET  /api/service/:rid?date=YYYY-MM-DD&at=HH:MM
 *   GET  /api/unit/:resourceGroupId   (PTAC unit / day diagram)
 *   GET  /api/units/catalog?fleet=158
 *   GET  /api/history/dates
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
 *   DARWIN_CLIENT_READY_AFTER  restored (default) | warm — gate non-health API until caches restored or until warmup completes
 *   DARWIN_*               Kafka creds from .env
 */

import { readdirSync, readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync, rmSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { loadAllJourneysIndexedByTiploc } from './timetable-loader.mjs';
import { loadTodaysReasons } from './reasons-loader.mjs';
import { loadTodaysLocations, loadSupplementalNamesFromFile, makeResolvers } from './locations-loader.mjs';
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
  departuresCacheMs: Number(process.env.DEPARTURES_CACHE_MS || 3000),
  // Historical ?date=&at= responses are expensive (gzip + full JSON). Keep
  // the assembled snapshot longer than live boards (still seconds-level for live).
  departuresHistCacheMs: Math.max(0, Number(process.env.DEPARTURES_HIST_CACHE_MS || 120_000)),
  internalApiKeys: (() => {
    const list = (process.env.INTERNAL_API_KEYS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
    const single = (process.env.INTERNAL_API_KEY || '').trim();
    return single ? [single] : [];
  })(),
  autoFetchFiles:  !['0', 'false', 'no'].includes(String(process.env.DARWIN_AUTO_FETCH_FILES || 'true').toLowerCase()),
  autoFetchTime:   process.env.DARWIN_AUTO_FETCH_TIME || '04:05',
  rawArchiveEnabled: !['0', 'false', 'no'].includes(String(process.env.RAW_ARCHIVE_ENABLED || 'true').toLowerCase()),
  rawArchiveCompress: !['0', 'false', 'no'].includes(String(process.env.RAW_ARCHIVE_COMPRESS || 'true').toLowerCase()),
  rawArchiveDir: process.env.RAW_ARCHIVE_DIR || resolve(__dirname, 'state/raw-feed'),
  rawArchiveRetentionDays: Math.max(1, Number(process.env.RAW_ARCHIVE_RETENTION_DAYS || 30)),
  // Background day-by-day historical warmup. After the API is "live_ready",
  // the daemon walks the most recent N days of state/history/<date>/ to prime
  // historical timetable, snapshot-list and context caches without blocking
  // live request handling. Guardrails skip a date if RSS or event-loop lag
  // breach the configured ceilings.
  warmupEnabled: !['0', 'false', 'no'].includes(String(process.env.WARMUP_ENABLED || 'true').toLowerCase()),
  warmupDays: Math.max(0, Number(process.env.WARMUP_DAYS || 7)),
  warmupMaxRssMb: Math.max(0, Number(process.env.WARMUP_MAX_RSS_MB || 4500)),
  warmupLagMs: Math.max(0, Number(process.env.WARMUP_LAG_MS || 200)),
};

// PTAC (S506) feed config — separate creds and consumer group from Darwin.
// All optional: if any are missing, the PTAC consumer is skipped silently.
const ptacCfg = {
  bootstrap:    process.env.PTAC_BOOTSTRAP || cfg.bootstrap,  // same Confluent cluster
  username:     process.env.PTAC_USERNAME,
  password:     process.env.PTAC_PASSWORD,
  topic:        process.env.PTAC_TOPIC || 'prod-1033-Passenger-Train-Allocation-and-Consist-1_0',
  groupId:      process.env.PTAC_GROUP_ID,
  // Default 12h replay window; override with PTAC_INITIAL_REPLAY_MIN if retention allows.
  initialReplay: Number(process.env.PTAC_INITIAL_REPLAY_MIN || 720),
  /**
   * rolling (default): replay last PTAC_INITIAL_REPLAY_MIN minutes from now.
   * ssd_0001: replay from 00:01 Europe/London on the current timetable SSD — use once to backfill after outages.
   */
  replayAnchor: (process.env.PTAC_REPLAY_ANCHOR || 'rolling').toLowerCase().trim(),
};

// ---------- pick today's timetable file ------------------------------------
function pickTodaysTimetable() {
  // Must match UK railway day (not UTC calendar date) so tt/YYYYMMDD aligns with journey SSD.
  const ymd = railwayDayYmd(new Date()).replace(/-/g, '');
  const dirs = [
    resolve(__dirname, `./tt/${ymd}`),
    resolve(__dirname, '../docs/V8s'),
    resolve(__dirname, '../docs/timetablefiles'),
  ];
  const nameRe = new RegExp(`^(?:PPTimetable_)?${ymd}\\d{6}_v(\\d+)\\.xml\\.gz$`);
  const all = [];
  for (const dir of dirs) {
    let files = []; try { files = readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (f.includes('_ref_')) continue;
      const m = f.match(nameRe);
      if (!m) continue;
      const ver = Number(m[1] || 0);
      all.push({ path: resolve(dir, f), ver });
    }
  }
  if (all.length === 0) throw new Error(`no timetable file for today (${ymd})`);
  all.sort((a, b) => b.ver - a.ver);
  return all[0].path;
}

function pickTimetableForDate(ymdDashed) {
  if (!isIsoDate(ymdDashed)) return null;
  const ymd = ymdToCompact(ymdDashed);
  const dir = resolve(__dirname, `./tt/${ymd}`);
  let files = [];
  try { files = readdirSync(dir); } catch { return null; }
  const nameRe = new RegExp(`^(?:PPTimetable_)?${ymd}\\d{6}_v(\\d+)\\.xml\\.gz$`);
  const matches = [];
  for (const f of files) {
    if (f.includes('_ref_')) continue;
    const m = f.match(nameRe);
    if (!m) continue;
    matches.push({ path: resolve(dir, f), ver: Number(m[1] || 0) });
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.ver - a.ver);
  return matches[0].path;
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

/** London wall-clock minute-of-day when the labelled operating day advances (02:00 → previous segment ends 01:59). */
const UK_RAILWAY_DAY_START_MINUTES = 2 * 60;

function railwayDayYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const pick = (type) => parts.find((p) => p.type === type)?.value || '00';
  const year = Number(pick('year'));
  const month = Number(pick('month'));
  const day = Number(pick('day'));
  const hour = Number(pick('hour'));
  const minute = Number(pick('minute'));

  const londonAsUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const railwayDayUtcMs = londonAsUtcMs - (UK_RAILWAY_DAY_START_MINUTES * 60 * 1000);
  return new Date(railwayDayUtcMs).toISOString().slice(0, 10);
}

function londonWallPartsAtUtcMs(ms) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const pick = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { y: pick('year'), mo: pick('month'), d: pick('day'), h: pick('hour'), mi: pick('minute'), s: pick('second') };
}

/** First UTC ms where Europe/London is calendar date `ssd` (YYYY-MM-DD) and local time ≥ 00:01:00. */
function ssdLondonCalendar001UtcMs(ssd) {
  const [Y, M, D] = ssd.split('-').map(Number);
  let lo = Date.UTC(Y, M - 1, D - 1, 12, 0, 0);
  let hi = Date.UTC(Y, M - 1, D + 1, 12, 0, 0);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const p = londonWallPartsAtUtcMs(mid);
    const dayMs = Date.UTC(p.y, p.mo - 1, p.d);
    const targetMs = Date.UTC(Y, M - 1, D);
    let ok = false;
    if (dayMs > targetMs) ok = true;
    else if (dayMs < targetMs) ok = false;
    else ok = p.h > 0 || (p.h === 0 && p.mi >= 1);
    if (ok) hi = mid;
    else lo = mid;
  }
  return hi;
}

function todayYmdCompact(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function anchorTime(hhmm, ssd) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm);
  if (!m) return null;
  const [, h, mn, s] = m;
  return new Date(`${ssd}T${h.padStart(2, '0')}:${mn}:${s || '00'}+01:00`);
}

/** Minutes since midnight from a timetable HH:MM[:SS] field. */
function scheduledMinutesFromMidnight(hhmm) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Aligns with railwayDayYmd(): times before 02:00 on the SSD calendar roll +24h for overnight display. */
const UK_RAIL_ROLLOVER_MINUTES = UK_RAILWAY_DAY_START_MINUTES;

function adjustScheduledInstantForRailwayOvernight(scheduledAt, scheduledTime) {
  const mins = scheduledMinutesFromMidnight(scheduledTime);
  if (mins != null && mins < UK_RAIL_ROLLOVER_MINUTES) {
    return new Date(scheduledAt.getTime() + 24 * 60 * 60_000);
  }
  return scheduledAt;
}
function describeLiveTime(node, actualKind, estKind) {
  if (!node || typeof node !== 'object') return null;
  const source = node.src ? String(unwrap(node.src)) : null;
  const sourceInstance = node.srcInst ? String(unwrap(node.srcInst)) : null;
  const unknownDelay = node.delayed === true || node.delayed === 'true';
  const manualUnknownDelay = node.etUnknown === true || node.etUnknown === 'true';
  if (node.at) {
    return { time: String(unwrap(node.at)), kind: actualKind, source, sourceInstance, unknownDelay, manualUnknownDelay };
  }
  if (node.et) {
    return { time: String(unwrap(node.et)), kind: estKind, source, sourceInstance, unknownDelay, manualUnknownDelay };
  }
  if (unknownDelay || manualUnknownDelay) {
    return { time: null, kind: estKind, source, sourceInstance, unknownDelay, manualUnknownDelay };
  }
  return null;
}

function bestDepartureFromLiveLoc(loc) {
  const dep = describeLiveTime(loc?.dep, 'actual', 'est');
  if (dep) return dep;
  // Passing points publish under `pass` (not `dep`/`arr`) in TS updates.
  const pass = describeLiveTime(loc?.pass, 'actual', 'est');
  if (pass) return pass;
  const arr = describeLiveTime(loc?.arr, 'actual-arr', 'est-arr');
  if (arr) return arr;
  return null;
}

function parseHmToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function computeDelayMinutes(scheduledTime, liveTime, liveKind) {
  if (!liveTime) return null;
  if (liveKind === 'scheduled' || liveKind === 'working') return 0;
  const sched = parseHmToMinutes(scheduledTime);
  const live = parseHmToMinutes(liveTime);
  if (sched == null || live == null) return null;
  // Choose the closest same-day/overnight delta in range [-12h, +12h].
  let diff = live - sched;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

/**
 * Normalise Darwin feed metadata into UI-facing service classes.
 * Output values are stable strings consumed by the frontend filter.
 */
function classifyServiceType({ trainCat, isPassenger, trainId, originName, destinationName }) {
  const cat = String(trainCat || '').toUpperCase();
  const headcodeClass = String(trainId || '').charAt(0);
  const replacementHints = ['rail replacement', 'replacement bus', 'bus replacement', 'bus service'];
  const endpoints = `${originName || ''} ${destinationName || ''}`.toLowerCase();
  if (replacementHints.some((hint) => endpoints.includes(hint))) return 'rail-replacement';
  if (cat === 'BR' || cat === 'BS' || cat.startsWith('B')) return 'rail-replacement';
  if (isPassenger) return 'passenger';
  if (['4', '6', '7', '8'].includes(headcodeClass)) return 'freight';
  if (cat.startsWith('E') || cat.startsWith('F') || cat.startsWith('H') || cat.startsWith('J') || cat.startsWith('M')) return 'freight';
  return 'other';
}

// ---------- reference data (reloadable on day rollover) --------------------
let byRid, byTiploc;                  // from timetable
let lateReasons, cancelReasons;       // from ref file
let locations, tocs, resolve_;        // from ref file
let supplementalStationNames;         // from optional non-Darwin station reference file
let crsToTiplocs;                     // CRS -> Array<TIPLOC>
let timetablePath, loadedDate;
// PTAC join key index built from byRid each reload.
//   "ssd|headcode|originTiploc|originHHMM" -> rid
// Plus a fallback "ssd|headcode|originTiploc" -> [rid, ...] for stop-time-only matches.
let ptacJoinByTuple, ptacJoinByOrigin;
let lastAutoFetchRunYmd = null;
const departuresCache = new Map(); // key -> { expiresAtMs, snapshot }

function runDailyFileFetch(reason = 'scheduled') {
  return new Promise((resolvePromise) => {
    execFile(
      'node',
      [resolve(__dirname, 'fetch-daily-timetables.mjs')],
      { cwd: __dirname, env: process.env },
      (error, stdout, stderr) => {
        if (stdout && stdout.trim()) {
          console.log(`[daemon] auto-fetch (${reason}) stdout:\n${stdout.trim()}`);
        }
        if (stderr && stderr.trim()) {
          console.warn(`[daemon] auto-fetch (${reason}) stderr:\n${stderr.trim()}`);
        }
        if (error) {
          console.warn(`[daemon] auto-fetch (${reason}) failed: ${error.message}`);
          resolvePromise(false);
          return;
        }
        console.log(`[daemon] auto-fetch (${reason}) completed.`);
        resolvePromise(true);
      }
    );
  });
}

function londonHHMM(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h}:${m}`;
}

async function maybeRunScheduledAutoFetch(now = new Date()) {
  if (!cfg.autoFetchFiles) return;
  const hhmm = londonHHMM(now);
  const today = railwayDayYmd(now).replace(/-/g, '');
  if (hhmm !== cfg.autoFetchTime) return;
  if (lastAutoFetchRunYmd === today) return;
  lastAutoFetchRunYmd = today;
  const ok = await runDailyFileFetch('04:05 schedule');
  if (ok) {
    try {
      reloadAllDataAndResetLive('post-fetch');
    } catch (e) {
      console.warn(`[daemon] post-fetch reload failed: ${e.message}`);
    }
  }
}

function reloadReferenceData() {
  timetablePath = pickTodaysTimetable();
  console.log(`[daemon] loading timetable ${timetablePath.split('/').pop()}`);
  ({ byRid, byTiploc } = loadAllJourneysIndexedByTiploc(timetablePath));
  ({ lateReasons, cancelReasons } = loadTodaysReasons());
  ({ locations, tocs } = loadTodaysLocations());
  const supplementalPath = process.env.DARWIN_STATIONS_REF_XML
    || resolve(__dirname, 'StationsRefData_v1.2.xml');
  supplementalStationNames = new Map();
  try {
    if (existsSync(supplementalPath)) {
      supplementalStationNames = loadSupplementalNamesFromFile(supplementalPath);
    } else {
      console.log(`[supplemental] file not found, skipping: ${supplementalPath}`);
    }
  } catch (e) {
    console.warn(`[supplemental] failed to load ${supplementalPath}: ${e.message}`);
  }
  resolve_ = makeResolvers({ locations, tocs, supplementalNames: supplementalStationNames });

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

  loadedDate = railwayDayYmd(new Date());
}

/**
 * After a new timetable is loaded, drop RID-keyed state that no longer maps to
 * a journey in `byRid`. Used on **day rollover** and **manual** reloads.
 * Skipped for **`post-fetch`** (scheduled 04:05): PTAC/unit data often arrives
 * hours earlier; we only reload timetable indexes and bust API caches then.
 */
function pruneMapsToValidRids() {
  if (!byRid) return;
  for (const rid of [...liveOverlayByRid.keys()]) {
    if (!byRid.has(rid)) liveOverlayByRid.delete(rid);
  }
  for (const rid of [...cancelled.keys()]) {
    if (!byRid.has(rid)) cancelled.delete(rid);
  }
  for (const rid of [...delayReason.keys()]) {
    if (!byRid.has(rid)) delayReason.delete(rid);
  }
  for (const rid of [...reverseFormation]) {
    if (!byRid.has(rid)) reverseFormation.delete(rid);
  }
  for (const rid of [...associationsByRid.keys()]) {
    if (!byRid.has(rid)) associationsByRid.delete(rid);
  }
  for (const rid of [...alertsByRid.keys()]) {
    if (!byRid.has(rid)) alertsByRid.delete(rid);
  }
  for (const rid of [...consistByRid.keys()]) {
    if (!byRid.has(rid)) consistByRid.delete(rid);
  }
  for (const rid of [...formationsByRid.keys()]) {
    if (!byRid.has(rid)) formationsByRid.delete(rid);
  }
  for (const [unitId, entry] of [...unitsById.entries()]) {
    const svcs = (entry.services || []).filter((s) => s.rid && byRid.has(s.rid));
    if (svcs.length === 0) unitsById.delete(unitId);
    else unitsById.set(unitId, { ...entry, services: svcs });
  }
}

function reloadAllDataAndResetLive(reason = 'manual') {
  console.log(`[daemon] reloading timetable/reference data (${reason}) ...`);
  reloadReferenceData();
  departuresCache.clear();

  const postFetchOnly = reason === 'post-fetch';
  if (postFetchOnly) {
    console.log(
      '[daemon] post-fetch: keeping PTAC/consist/units/formations, live overlays, '
      + 'and NRCC caches — timetable join indexes refreshed only.'
    );
  } else {
    stationMessages.clear();
    messagesById.clear();
    pruneMapsToValidRids();
  }

  const retried = retryUnmatchedConsists();
  if (retried > 0) {
    console.log(`[daemon] PTAC retry after timetable reload: matched ${retried} previously-unmatched consists.`);
  }
  historicalContextCache.clear();
  persistState();
}

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
const unitsById    = new Map();       // unitId -> { fleetId, vehicles, lastSeenRid, services, endOfDayMileageByDate, lastEndOfDayMiles, updatedAt }
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
// shutdown, then reload them on startup. Formations + PTAC consists + units
// are stored as three gzip shards beside each core JSON so stringify stays
// within V8 limits. Live overlays (forecasts, actuals, platform changes) are
// high-churn and Darwin rebroadcasts them frequently.
const STATE_DIR  = resolve(__dirname, 'state');
const STATE_FILE = resolve(STATE_DIR, 'daemon-cache.json');
const STATE_HISTORY_DIR = resolve(STATE_DIR, 'history');
const UNIT_CATALOG_FILE = resolve(STATE_DIR, 'unit-catalog.json');
const PERSIST_INTERVAL_SEC = Number(process.env.PERSIST_INTERVAL_SEC || 30);
const KEEP_STATE_ACROSS_DAYS = !['0', 'false', 'no'].includes(String(process.env.KEEP_STATE_ACROSS_DAYS || 'true').toLowerCase());
const PROTECT_RICHER_STATE = !['0', 'false', 'no'].includes(String(process.env.PROTECT_RICHER_STATE || 'true').toLowerCase());
const STATE_SNAPSHOT_COUNT = Math.max(0, Number(process.env.STATE_SNAPSHOT_COUNT || 24));
const STATE_HISTORY_RETENTION_DAYS = Math.max(1, Number(process.env.STATE_HISTORY_RETENTION_DAYS || 90));
const STATE_HISTORY_PRUNE_ON_PERSIST = !['0', 'false', 'no'].includes(String(process.env.STATE_HISTORY_PRUNE_ON_PERSIST || 'true').toLowerCase());
const STATE_HISTORY_COMPRESS_SNAPSHOTS = !['0', 'false', 'no'].includes(String(process.env.STATE_HISTORY_COMPRESS_SNAPSHOTS || 'true').toLowerCase());
const STATE_HISTORY_GZIP_LEVEL = Math.max(1, Math.min(9, Number(process.env.STATE_HISTORY_GZIP_LEVEL || 6)));
/** Shard gzip level — separate env so operators can favour speed on huge PTAC maps without touching history snaps. */
const STATE_HEAVY_GZIP_LEVEL = Math.max(1, Math.min(9, Number(process.env.STATE_HEAVY_GZIP_LEVEL || STATE_HISTORY_GZIP_LEVEL)));
let lastPersistAt = null;
let lastUnitCatalogPersistAt = null;
const unitCatalogById = new Map(); // unitId -> cumulative unit record across days
const historicalContextCache = new Map(); // date -> { loadedAtMs, byRid, overlays }
const historicalTimetableCache = new Map(); // date -> { loadedAtMs, byRid, byTiploc }
const historicalStateFileCache = new Map(); // path -> { loadedAtMs, raw }
const historySnapshotListCache = new Map(); // ymd -> { loadedAtMs, list }
const snapshotIndexCache = new Map();       // ymd -> { loadedAtMs, list }
const rawArchivePrunedYmd = new Set();

// ---------- daemon lifecycle mode + warmup tracking ----------------------
// Surfaced in /api/health so callers can tell whether long-lived caches have
// finished warming. Order of transitions:
//   cold_starting -> live_ready -> warming_history -> fully_warm
// The mode never goes backwards once advanced; if the warmup fails we still
// land in fully_warm and surface the error in warmupState.errors.
let daemonMode = 'cold_starting';
/** After background applyPersistedStateRest (formations, PTAC, messages, …). Used to gate client reads when policy is `restored`. */
let liveCachesReady = false;
const warmupState = {
  enabled: !['0', 'false', 'no'].includes(String(process.env.WARMUP_ENABLED || 'true').toLowerCase()),
  days: Math.max(0, Number(process.env.WARMUP_DAYS || 7)),
  startedAt: null,
  finishedAt: null,
  current: null,
  done: [],
  skipped: [],
  errors: [],
};
// Historical timetable XML parsing is ~20–30s per date on the VM — keep parsed
// indexes hot for a full railway day so browsing ?date=&at= stays responsive
// after idle gaps. (Still bounded by HIST_TIMETABLE_CACHE_MAX.)
const HIST_TIMETABLE_CACHE_TTL_MS = Number(process.env.HIST_TIMETABLE_CACHE_TTL_MS || 24 * 60 * 60_000);
const HIST_TIMETABLE_CACHE_MAX = Math.max(1, Number(process.env.HIST_TIMETABLE_CACHE_MAX || 14));
const HIST_CONTEXT_CACHE_TTL_MS = Number(process.env.HIST_CONTEXT_CACHE_TTL_MS || 30 * 60_000);
const HIST_CONTEXT_CACHE_MAX = Math.max(1, Number(process.env.HIST_CONTEXT_CACHE_MAX || 48));
const HIST_STATE_FILE_CACHE_TTL_MS = Number(process.env.HIST_STATE_FILE_CACHE_TTL_MS || 60 * 60_000);
const HIST_STATE_FILE_CACHE_MAX = Math.max(1, Number(process.env.HIST_STATE_FILE_CACHE_MAX || 32));
const HIST_SNAPSHOT_LIST_CACHE_TTL_MS = Number(process.env.HIST_SNAPSHOT_LIST_CACHE_TTL_MS || 60_000);

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

function ymdToCompact(ymd) {
  return String(ymd || '').replace(/-/g, '');
}

function compareIsoDate(a, b) {
  if (!isIsoDate(a) || !isIsoDate(b)) return 0;
  return a.localeCompare(b);
}

function addDaysIsoDate(ymd, days) {
  const base = new Date(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(base.getTime())) return ymd;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function availableHistoryDates() {
  let entries = [];
  try { entries = readdirSync(STATE_HISTORY_DIR); } catch { return []; }
  return entries.filter((d) => isIsoDate(d)).sort().reverse();
}

function pruneHistoryDirsByRetention() {
  if (!STATE_HISTORY_PRUNE_ON_PERSIST) return;
  const cutoff = Date.now() - (STATE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const dates = availableHistoryDates();
  for (const d of dates) {
    const ts = Date.parse(`${d}T00:00:00Z`);
    if (!Number.isFinite(ts) || ts >= cutoff) continue;
    try {
      rmSync(resolve(STATE_HISTORY_DIR, d), { recursive: true, force: true });
    } catch {}
  }
}

function pruneRawArchiveByRetention() {
  if (!cfg.rawArchiveEnabled) return;
  let dayDirs = [];
  try { dayDirs = readdirSync(cfg.rawArchiveDir); } catch { return; }
  const cutoff = Date.now() - (cfg.rawArchiveRetentionDays * 24 * 60 * 60 * 1000);
  for (const d of dayDirs) {
    if (!/^\d{8}$/.test(d)) continue;
    const ymd = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const ts = Date.parse(`${ymd}T00:00:00Z`);
    if (!Number.isFinite(ts) || ts >= cutoff) continue;
    try { rmSync(resolve(cfg.rawArchiveDir, d), { recursive: true, force: true }); } catch {}
  }
}

function archiveRawFeed(feed, rawBuf) {
  if (!cfg.rawArchiveEnabled || !rawBuf) return;
  try {
    const now = new Date();
    const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const dayDir = resolve(cfg.rawArchiveDir, ymd);
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });
    const out = resolve(dayDir, `${feed}-${hh}.ndjson${cfg.rawArchiveCompress ? '.gz' : ''}`);
    const line = JSON.stringify({
      ts: now.toISOString(),
      feed,
      payload: rawBuf.toString('utf8'),
    }) + '\n';
    if (cfg.rawArchiveCompress) appendFileSync(out, gzipSync(line));
    else appendFileSync(out, line);
    if (!rawArchivePrunedYmd.has(ymd)) {
      pruneRawArchiveByRetention();
      rawArchivePrunedYmd.add(ymd);
      if (rawArchivePrunedYmd.size > 7) {
        for (const v of [...rawArchivePrunedYmd].slice(0, rawArchivePrunedYmd.size - 7)) rawArchivePrunedYmd.delete(v);
      }
    }
  } catch (e) {
    console.warn(`[archive] failed writing ${feed} raw message: ${e.message}`);
  }
}

function stateScore(raw = {}) {
  const count = (arr) => Array.isArray(arr) ? arr.length : 0;
  return (
    count(raw.formations) * 5
    + count(raw.consistByRid) * 4
    + count(raw.unitsById) * 4
    + count(raw.associations) * 2
    + count(raw.messagesById)
    + count(raw.stationMessages)
    + count(raw.alerts)
    + count(raw.reverseFormation)
    + count(raw.unmatchedConsists)
  );
}

/** Path prefix (no suffix) for formations/consist/units shards next to a core state file. */
function heavyStemForCore(corePath) {
  const dir = dirname(corePath);
  const base = basename(corePath);
  if (base === 'daemon-cache.json') return resolve(dir, 'daemon-cache-heavy');
  if (base === 'daemon-cache.latest.json') return resolve(dir, 'daemon-cache-heavy.latest');
  let m = /^daemon-cache\.(.+)\.json$/.exec(base);
  if (m) return resolve(dir, `daemon-cache-heavy.${m[1]}`);
  m = /^daemon-cache\.(.+)\.json\.gz$/.exec(base);
  if (m) return resolve(dir, `daemon-cache-heavy.${m[1]}`);
  return null;
}

function deleteHeavyShards(stem) {
  if (!stem) return;
  for (const label of ['formations', 'consist', 'units']) {
    try { unlinkSync(`${stem}.${label}.json.gz`); } catch {}
  }
}

function writeHeavyShardsAtomic(stem, formations, consistByRid, unitsById) {
  if (!stem) return;
  const chunks = [
    ['formations', formations],
    ['consist', consistByRid],
    ['units', unitsById],
  ];
  for (const [label, arr] of chunks) {
    const finalPath = `${stem}.${label}.json.gz`;
    const tmpPath = `${finalPath}.tmp`;
    const buf = gzipSync(JSON.stringify(Array.isArray(arr) ? arr : []), { level: STATE_HEAVY_GZIP_LEVEL });
    writeFileSync(tmpPath, buf);
    renameSync(tmpPath, finalPath);
  }
}

/** Merge gzip shards written beside core JSON (schema v2). Legacy cores still carry inline arrays. */
function attachHeavyShards(raw, corePath) {
  if (!raw || typeof raw !== 'object') return raw;
  const stem = heavyStemForCore(corePath);
  if (!stem) return raw;
  try {
    const fpForm = `${stem}.formations.json.gz`;
    const fpCons = `${stem}.consist.json.gz`;
    const fpUnits = `${stem}.units.json.gz`;
    if (existsSync(fpForm)) {
      raw.formations = JSON.parse(gunzipSync(readFileSync(fpForm)).toString('utf8'));
    }
    if (existsSync(fpCons)) {
      raw.consistByRid = JSON.parse(gunzipSync(readFileSync(fpCons)).toString('utf8'));
    }
    if (existsSync(fpUnits)) {
      raw.unitsById = JSON.parse(gunzipSync(readFileSync(fpUnits)).toString('utf8'));
    }
  } catch (e) {
    console.warn(`[daemon] failed to merge heavy state shards for ${corePath}: ${e.message}`);
  }
  return raw;
}

function readMergedStateFromDisk() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    return attachHeavyShards(raw, STATE_FILE);
  } catch {
    return null;
  }
}

/** Strip heavy arrays for core JSON; arrays always returned for gzip shards (even when []). */
function splitMergedForPersist(merged) {
  const formations = Array.isArray(merged.formations) ? merged.formations : [];
  const consistByRid = Array.isArray(merged.consistByRid) ? merged.consistByRid : [];
  const unitsById = Array.isArray(merged.unitsById) ? merged.unitsById : [];
  const {
    formations: _fa,
    consistByRid: _ca,
    unitsById: _ua,
    ...coreRest
  } = merged;
  const core = {
    ...coreRest,
    stateSchema: merged.stateSchema ?? 2,
  };
  return { core, formations, consistByRid, unitsById };
}

function pruneOldStateSnapshots() {
  if (STATE_SNAPSHOT_COUNT <= 0) return;
  const prefix = 'daemon-cache.';
  const suffix = '.json';
  let files = [];
  try { files = readdirSync(STATE_DIR); } catch { return; }
  const snapshots = files
    .filter((f) => f.startsWith(prefix) && f.endsWith(suffix) && f !== 'daemon-cache.json')
    .sort()
    .reverse();
  for (const stale of snapshots.slice(STATE_SNAPSHOT_COUNT)) {
    try { unlinkSync(resolve(STATE_DIR, stale)); } catch {}
    const stampMatch = /^daemon-cache\.(.+)\.json$/.exec(stale);
    if (stampMatch) {
      deleteHeavyShards(resolve(STATE_DIR, `daemon-cache-heavy.${stampMatch[1]}`));
    }
  }
}

function toMap(entries) {
  const m = new Map();
  if (!Array.isArray(entries)) return m;
  for (const [k, v] of entries) m.set(k, v);
  return m;
}

function serializeLiveOverlayEntries() {
  return [...liveOverlayByRid.entries()].map(([rid, ov]) => [
    rid,
    {
      ...(ov || {}),
      locs: [...((ov?.locs || new Map()).entries())],
    },
  ]);
}

function restoreLiveOverlayEntries(entries) {
  if (!Array.isArray(entries)) return;
  for (const [rid, ov] of entries) {
    if (!rid || !ov) continue;
    const locs = new Map(Array.isArray(ov.locs) ? ov.locs : []);
    liveOverlayByRid.set(rid, { ...ov, locs });
  }
}

function getOverlayLoc(ov, tpl) {
  if (!ov || !tpl) return null;
  const locs = ov.locs;
  if (!locs) return null;
  if (locs instanceof Map) return locs.get(tpl) || null;
  if (Array.isArray(locs)) {
    const m = new Map(locs);
    ov.locs = m;
    return m.get(tpl) || null;
  }
  if (typeof locs === 'object') return locs[tpl] || null;
  return null;
}

function parseAtToMinutes(at) {
  if (!at) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(at).trim());
  if (!m) return null;
  const h = Number(m[1]); const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** Wall-clock London instant for ?date=&at= — fixed +01:00 matches anchorTime(). */
function londonWallInstantFromDateAt(dateStr, atStr) {
  if (!dateStr || !isIsoDate(dateStr)) return null;
  if (atStr != null && parseAtToMinutes(atStr) != null) {
    const mins = parseAtToMinutes(atStr);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return new Date(`${dateStr}T${hh}:${mm}:00+01:00`);
  }
  return new Date(`${dateStr}T12:00:00+01:00`);
}

function normalizeCancellationInfo(info) {
  if (!info) return null;
  const reason = String(info.reason || '').trim().toLowerCase();
  // Darwin occasionally emits generic "schedule deactivated" cancellations
  // that are not useful for passenger-facing history views.
  if (reason.includes('schedule deactivated')) return null;
  return info;
}

function pruneHistoricalTimetableCache() {
  const now = Date.now();
  for (const [k, v] of historicalTimetableCache.entries()) {
    if (now - (v.loadedAtMs || 0) > HIST_TIMETABLE_CACHE_TTL_MS) historicalTimetableCache.delete(k);
  }
  if (historicalTimetableCache.size <= HIST_TIMETABLE_CACHE_MAX) return;
  const ordered = [...historicalTimetableCache.entries()].sort((a, b) => (a[1].loadedAtMs || 0) - (b[1].loadedAtMs || 0));
  for (const [k] of ordered.slice(0, historicalTimetableCache.size - HIST_TIMETABLE_CACHE_MAX)) {
    historicalTimetableCache.delete(k);
  }
}

function getHistoricalTimetable(ymdDashed) {
  // Same-day lookups should reuse already-loaded live timetable indexes to
  // avoid expensive synchronous reparsing on request path.
  if (ymdDashed === loadedDate && byRid && byTiploc) {
    return { loadedAtMs: Date.now(), byRid, byTiploc };
  }
  const cached = historicalTimetableCache.get(ymdDashed);
  const now = Date.now();
  if (cached && now - (cached.loadedAtMs || 0) <= HIST_TIMETABLE_CACHE_TTL_MS) return cached;
  const timetable = pickTimetableForDate(ymdDashed);
  if (!timetable) return null;
  const parsed = loadAllJourneysIndexedByTiploc(timetable);
  const entry = { loadedAtMs: now, byRid: parsed.byRid, byTiploc: parsed.byTiploc };
  historicalTimetableCache.set(ymdDashed, entry);
  pruneHistoricalTimetableCache();
  return entry;
}

// state/history/<date>/snapshot-index.json. Stores a pre-computed sorted list
// of [{ file, ms }] for every snapshot we've persisted on that day. Building
// it once turns the per-request `readdirSync` + filename regex parsing into a
// single fs.read + JSON.parse, which is materially faster on cold dates after
// 24h of accumulated snapshots (~720 files at PERSIST_INTERVAL_SEC=120s).
function snapshotIndexFile(ymdDashed) {
  return resolve(STATE_HISTORY_DIR, ymdDashed, 'snapshot-index.json');
}

function snapshotsFromReaddir(ymdDashed) {
  const dayDir = resolve(STATE_HISTORY_DIR, ymdDashed);
  let files = [];
  try { files = readdirSync(dayDir); } catch { return []; }
  const re = /^daemon-cache\.(.+)\.json(?:\.gz)?$/;
  return files
    .filter((f) => re.test(f) && f !== 'daemon-cache.latest.json')
    .map((f) => {
      const m = f.match(re);
      const stamp = m?.[1] || '';
      const sm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(stamp);
      const iso = sm ? `${sm[1]}-${sm[2]}-${sm[3]}T${sm[4]}:${sm[5]}:${sm[6]}.${sm[7]}Z` : null;
      const t = iso ? Date.parse(iso) : NaN;
      return { file: f, path: resolve(dayDir, f), savedAt: Number.isFinite(t) ? new Date(t).toISOString() : null, ms: Number.isFinite(t) ? t : -1 };
    })
    .filter((e) => e.ms >= 0)
    .sort((a, b) => a.ms - b.ms);
}

function buildSnapshotIndexForDate(ymdDashed) {
  if (!isIsoDate(ymdDashed)) return [];
  const dayDir = resolve(STATE_HISTORY_DIR, ymdDashed);
  if (!existsSync(dayDir)) return [];
  const list = snapshotsFromReaddir(ymdDashed);
  try {
    const indexPath = snapshotIndexFile(ymdDashed);
    const tmp = indexPath + '.tmp';
    const payload = {
      builtAt: new Date().toISOString(),
      date: ymdDashed,
      list: list.map((e) => ({ file: e.file, ms: e.ms, savedAt: e.savedAt })),
    };
    writeFileSync(tmp, JSON.stringify(payload));
    renameSync(tmp, indexPath);
  } catch (e) {
    // Best-effort — failures here just mean we'll rebuild next request.
  }
  snapshotIndexCache.set(ymdDashed, { loadedAtMs: Date.now(), list });
  historySnapshotListCache.set(ymdDashed, { loadedAtMs: Date.now(), list });
  return list;
}

function readSnapshotIndexForDate(ymdDashed) {
  const cached = snapshotIndexCache.get(ymdDashed);
  if (cached && Date.now() - (cached.loadedAtMs || 0) <= HIST_SNAPSHOT_LIST_CACHE_TTL_MS) return cached.list;
  const indexPath = snapshotIndexFile(ymdDashed);
  if (!existsSync(indexPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(indexPath, 'utf8'));
    const dayDir = resolve(STATE_HISTORY_DIR, ymdDashed);
    const list = (parsed.list || [])
      .filter((e) => e && Number.isFinite(e.ms))
      .map((e) => ({ file: e.file, ms: e.ms, savedAt: e.savedAt || null, path: resolve(dayDir, e.file) }))
      .sort((a, b) => a.ms - b.ms);
    snapshotIndexCache.set(ymdDashed, { loadedAtMs: Date.now(), list });
    return list;
  } catch {
    return null;
  }
}

// Binary search — return the latest snapshot whose ms <= cutoffMs, or null.
function findSnapshotAtOrBefore(list, cutoffMs) {
  if (!Array.isArray(list) || list.length === 0) return null;
  let lo = 0, hi = list.length - 1, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const entry = list[mid];
    if (entry.ms <= cutoffMs) { best = entry; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best;
}

function listHistorySnapshotsForDate(ymdDashed) {
  if (!isIsoDate(ymdDashed)) return [];
  const now = Date.now();
  const cached = historySnapshotListCache.get(ymdDashed);
  if (cached && now - (cached.loadedAtMs || 0) <= HIST_SNAPSHOT_LIST_CACHE_TTL_MS) return cached.list;
  // Phase 4: prefer the disk-backed snapshot-index.json. It's much cheaper
  // than scanning the directory on dates with hundreds of snapshot files.
  const indexed = readSnapshotIndexForDate(ymdDashed);
  if (indexed) {
    historySnapshotListCache.set(ymdDashed, { loadedAtMs: now, list: indexed });
    return indexed;
  }
  // Fallback for dates that haven't been indexed yet — compute by readdir
  // and build the index file so subsequent requests are fast.
  const list = snapshotsFromReaddir(ymdDashed);
  historySnapshotListCache.set(ymdDashed, { loadedAtMs: now, list });
  if (historySnapshotListCache.size > HIST_CONTEXT_CACHE_MAX) {
    const ordered = [...historySnapshotListCache.entries()].sort((a, b) => (a[1].loadedAtMs || 0) - (b[1].loadedAtMs || 0));
    for (const [k] of ordered.slice(0, historySnapshotListCache.size - HIST_CONTEXT_CACHE_MAX)) historySnapshotListCache.delete(k);
  }
  // Persist the index asynchronously so we don't add latency to the current
  // request. Best-effort.
  setImmediate(() => {
    try { buildSnapshotIndexForDate(ymdDashed); } catch {}
  });
  return list;
}

/** Read gzip/plain JSON state and merge formations/consist/units shards beside the core file. */
function readHistoricalStateFile(corePath) {
  if (!existsSync(corePath)) return null;
  const now = Date.now();
  const cached = historicalStateFileCache.get(corePath);
  if (cached && now - (cached.loadedAtMs || 0) <= HIST_STATE_FILE_CACHE_TTL_MS) return cached.raw;
  try {
    let raw;
    if (corePath.endsWith('.gz')) {
      raw = JSON.parse(gunzipSync(readFileSync(corePath)).toString('utf8'));
    } else {
      raw = JSON.parse(readFileSync(corePath, 'utf8'));
    }
    attachHeavyShards(raw, corePath);
    historicalStateFileCache.set(corePath, { loadedAtMs: now, raw });
    if (historicalStateFileCache.size > HIST_STATE_FILE_CACHE_MAX) {
      const ordered = [...historicalStateFileCache.entries()].sort((a, b) => (a[1].loadedAtMs || 0) - (b[1].loadedAtMs || 0));
      for (const [k] of ordered.slice(0, historicalStateFileCache.size - HIST_STATE_FILE_CACHE_MAX)) historicalStateFileCache.delete(k);
    }
    return raw;
  } catch {
    return null;
  }
}

function buildOverlayHistorySeries(hours = 36) {
  const nowMs = Date.now();
  const safeHours = Math.max(1, Math.min(168, Number(hours) || 36));
  const cutoffMs = nowMs - (safeHours * 60 * 60 * 1000);
  const points = [];
  const dates = availableHistoryDates().filter((d) => {
    const dayMs = Date.parse(`${d}T00:00:00Z`);
    return Number.isFinite(dayMs) && dayMs >= (cutoffMs - 24 * 60 * 60 * 1000);
  });

  for (const d of dates) {
    const snaps = listHistorySnapshotsForDate(d);
    for (const s of snaps) {
      if (!s.path || !Number.isFinite(s.ms) || s.ms < cutoffMs) continue;
      const raw = readHistoricalStateFile(s.path);
      if (!raw) continue;
      points.push({
        savedAt: raw.savedAt || (s.savedAt || null),
        formations: Array.isArray(raw.formations) ? raw.formations.length : 0,
        consists: Array.isArray(raw.consistByRid) ? raw.consistByRid.length : 0,
        units: Array.isArray(raw.unitsById) ? raw.unitsById.length : 0,
      });
    }
  }

  points.sort((a, b) => String(a.savedAt || '').localeCompare(String(b.savedAt || '')));
  return {
    hours: safeHours,
    count: points.length,
    points,
    updatedAt: new Date().toISOString(),
  };
}

function loadUnitCatalog() {
  if (!existsSync(UNIT_CATALOG_FILE)) return;
  try {
    const raw = JSON.parse(readFileSync(UNIT_CATALOG_FILE, 'utf8'));
    for (const [unitId, entry] of (raw.units || [])) {
      if (!unitId || !entry) continue;
      unitCatalogById.set(unitId, entry);
    }
    console.log(`[daemon] restored unit catalog: ${unitCatalogById.size} units.`);
  } catch (e) {
    console.warn(`[daemon] failed to load unit catalog: ${e.message}`);
  }
}

function mergeUnitIntoCatalog(unitEntry) {
  if (!unitEntry?.unitId) return;
  const nowIso = new Date().toISOString();
  const existing = unitCatalogById.get(unitEntry.unitId);
  const incomingMileageByDate = unitEntry.endOfDayMileageByDate && typeof unitEntry.endOfDayMileageByDate === 'object'
    ? unitEntry.endOfDayMileageByDate
    : {};
  if (!existing) {
    unitCatalogById.set(unitEntry.unitId, {
      unitId: unitEntry.unitId,
      fleetId: unitEntry.fleetId || null,
      vehicles: unitEntry.vehicles || [],
      services: unitEntry.services || [],
      endOfDayMileageByDate: incomingMileageByDate,
      lastEndOfDayMiles: unitEntry.lastEndOfDayMiles ?? null,
      firstSeenAt: unitEntry.updatedAt || nowIso,
      lastSeenAt: unitEntry.updatedAt || nowIso,
      updatedAt: unitEntry.updatedAt || nowIso,
    });
    return;
  }
  existing.fleetId = unitEntry.fleetId || existing.fleetId || null;
  if (Array.isArray(unitEntry.vehicles) && unitEntry.vehicles.length > 0) {
    existing.vehicles = unitEntry.vehicles;
  }
  const seen = new Set((existing.services || []).map((s) => `${s.rid}|${s.start || ''}|${s.end || ''}`));
  for (const svc of (unitEntry.services || [])) {
    const key = `${svc.rid}|${svc.start || ''}|${svc.end || ''}`;
    if (seen.has(key)) continue;
    existing.services.push(svc);
    seen.add(key);
  }
  existing.services.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  existing.endOfDayMileageByDate = {
    ...((existing.endOfDayMileageByDate && typeof existing.endOfDayMileageByDate === 'object') ? existing.endOfDayMileageByDate : {}),
    ...incomingMileageByDate,
  };
  if (unitEntry.lastEndOfDayMiles != null) existing.lastEndOfDayMiles = unitEntry.lastEndOfDayMiles;
  existing.lastSeenAt = unitEntry.updatedAt || nowIso;
  existing.updatedAt = unitEntry.updatedAt || nowIso;
}

function persistUnitCatalog() {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    const payload = {
      savedAt: new Date().toISOString(),
      units: [...unitCatalogById.entries()],
    };
    const tmp = UNIT_CATALOG_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(payload));
    renameSync(tmp, UNIT_CATALOG_FILE);
    lastUnitCatalogPersistAt = payload.savedAt;
  } catch (e) {
    console.warn(`[daemon] failed to persist unit catalog: ${e.message}`);
  }
}

function historyFileForDate(ymdDashed) {
  return resolve(STATE_HISTORY_DIR, ymdDashed, 'daemon-cache.latest.json');
}

function loadPersistedStateForDate(ymdDashed, at = null) {
  if (!isIsoDate(ymdDashed)) return null;
  const candidates = [];
  const atMin = parseAtToMinutes(at);
  if (at && atMin != null) {
    const snaps = listHistorySnapshotsForDate(ymdDashed);
    const cutoff = Date.parse(`${ymdDashed}T${String(Math.floor(atMin / 60)).padStart(2, '0')}:${String(atMin % 60).padStart(2, '0')}:59Z`);
    // Phase 4: binary search the sorted-by-ms list instead of linear scan.
    // Falls through to the latest snapshot if no snapshot is older than the
    // requested cutoff (preserves previous behaviour).
    const pick = findSnapshotAtOrBefore(snaps, cutoff) || snaps[snaps.length - 1];
    if (pick) candidates.push(pick.path);
  }
  candidates.push(
    historyFileForDate(ymdDashed),
    resolve(STATE_DIR, `daemon-cache.${ymdDashed}.json`),
    resolve(STATE_DIR, `daemon-cache.${ymdDashed}.json.gz`),
  );
  if (ymdDashed === loadedDate) candidates.unshift(STATE_FILE);
  for (const p of candidates) {
    const raw = readHistoricalStateFile(p);
    if (raw) return raw;
  }
  return null;
}

function getHistoricalContext(ymdDashed, at = null) {
  if (!isIsoDate(ymdDashed)) return null;
  const cacheKey = `${ymdDashed}|${at || ''}`;
  const cached = historicalContextCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAtMs <= HIST_CONTEXT_CACHE_TTL_MS) return cached;

  const histTimetable = getHistoricalTimetable(ymdDashed);
  if (!histTimetable) return null;
  const histByRid = histTimetable.byRid;
  const histByTiploc = histTimetable.byTiploc;
  const state = loadPersistedStateForDate(ymdDashed, at);
  if (!state) return null;

  const histOverlay = new Map();
  for (const [rid, ov] of (state.liveOverlayByRid || [])) {
    const locs = Array.isArray(ov?.locs) ? new Map(ov.locs) : (ov?.locs instanceof Map ? ov.locs : new Map());
    histOverlay.set(rid, { ...(ov || {}), locs });
  }

  const ctx = {
    loadedAtMs: Date.now(),
    historicalDate: ymdDashed,
    historicalAt: at || null,
    byRid: histByRid,
    byTiploc: histByTiploc,
    liveOverlayByRid: histOverlay,
    cancelled: toMap(state.cancelled || []),
    delayReason: toMap(state.delayReason || []),
    reverseFormation: new Set(state.reverseFormation || []),
    formationsByRid: toMap(state.formations || []),
    consistByRid: toMap(state.consistByRid || []),
    associationsByRid: toMap(state.associations || []),
    alertsByRid: toMap(state.alerts || []),
    stateSavedAt: state.savedAt || null,
  };
  historicalContextCache.set(cacheKey, ctx);
  if (historicalContextCache.size > HIST_CONTEXT_CACHE_MAX) {
    const ordered = [...historicalContextCache.entries()].sort((a, b) => (a[1].loadedAtMs || 0) - (b[1].loadedAtMs || 0));
    for (const [k] of ordered.slice(0, historicalContextCache.size - HIST_CONTEXT_CACHE_MAX)) historicalContextCache.delete(k);
  }
  return ctx;
}

function getTimetableOnlyContext(ymdDashed, at = null) {
  if (!isIsoDate(ymdDashed)) return null;
  const timetable = getHistoricalTimetable(ymdDashed);
  if (!timetable) return null;
  return {
    loadedAtMs: Date.now(),
    historicalDate: ymdDashed,
    historicalAt: at || null,
    byRid: timetable.byRid,
    byTiploc: timetable.byTiploc,
    liveOverlayByRid: new Map(),
    cancelled: new Map(),
    delayReason: new Map(),
    reverseFormation: new Set(),
    formationsByRid: new Map(),
    consistByRid: new Map(),
    associationsByRid: new Map(),
    alertsByRid: new Map(),
    stateSavedAt: null,
  };
}

function getLiveTimedContext(ymdDashed, at = null) {
  if (!isIsoDate(ymdDashed)) return null;
  const liveDate = loadedDate || railwayDayYmd(new Date());
  if (ymdDashed !== liveDate) return null;
  return {
    loadedAtMs: Date.now(),
    historicalDate: ymdDashed,
    historicalAt: at || null,
    byRid,
    byTiploc,
    liveOverlayByRid,
    cancelled,
    delayReason,
    reverseFormation,
    formationsByRid,
    consistByRid,
    associationsByRid,
    alertsByRid,
    stateSavedAt: null,
  };
}

// Read the persisted state file once and apply the freshness check that the
// "discard stale-day" mode wants. Returns the parsed payload or null. We split
// state restore into a fast "live subset" pass (so the API can answer real
// requests within a few seconds of restart) and a "rest" pass run in the
// background. Both passes use the payload returned here, so the file is read
// at most once per restart.
function readPersistedStateRawIfFresh() {
  if (!existsSync(STATE_FILE)) {
    console.log(`[daemon] no persisted state at ${STATE_FILE} — starting fresh.`);
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    attachHeavyShards(raw, STATE_FILE);
    if (!KEEP_STATE_ACROSS_DAYS && raw.savedDate && raw.savedDate !== railwayDayYmd(new Date())) {
      console.log(`[daemon] persisted state is from ${raw.savedDate}, today is ${railwayDayYmd(new Date())} — discarding.`);
      return null;
    }
    return raw;
  } catch (e) {
    console.warn(`[daemon] failed to load persisted state: ${e.message}`);
    return null;
  }
}

// Restore only the small, high-value caches that affect /api/departures and
// /api/service immediately on boot — predicted/actual times, cancellations
// and delay reasons. Cheap (a few MB) and fast to apply.
function applyPersistedStateLive(raw) {
  if (!raw) return;
  if (raw.liveOverlayByRid)  restoreLiveOverlayEntries(raw.liveOverlayByRid);
  if (raw.cancelled)         for (const [k, v] of raw.cancelled)         cancelled.set(k, v);
  if (raw.delayReason)       for (const [k, v] of raw.delayReason)       delayReason.set(k, v);
}

// Restore the larger long-lived caches (formations, NRCC messages, PTAC
// consists & unit index, associations, alerts). These take longer to walk
// because the per-RID payloads are richer — we run this *after* server.listen
// returns, so the socket is already accepting requests.
function applyPersistedStateRest(raw) {
  if (!raw) return;
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
  const retriedAfterRestore = retryUnmatchedConsists();
  if (retriedAfterRestore > 0) {
    console.log(`[daemon] PTAC retry after persisted restore: matched ${retriedAfterRestore} queued consists.`);
  }
  console.log(
    `[daemon] restored persisted state: ${formationsByRid.size} formations, `
    + `${consistByRid.size} consists, ${unitsById.size} units, `
    + `${messagesById.size} messages, ${associationsByRid.size} associations, `
    + `${alertsByRid.size} alerted services, ${reverseFormation.size} reverse formations.`
  );
}

function loadPersistedState() {
  const raw = readPersistedStateRawIfFresh();
  if (!raw) return;
  applyPersistedStateLive(raw);
  applyPersistedStateRest(raw);
}

// ---------- Phase 3: background day-by-day historical warmup ----------------
// After /api/health is "live_ready" we walk the most recent N days of
// state/history/<date>/ from newest to oldest. For each date we prime:
//   - historicalTimetableCache (parsed timetable index)
//   - historySnapshotListCache (per-day snapshot list)
//   - historicalContextCache (final composed context for the latest snapshot)
//   - state/history/<date>/snapshot-index.json (Phase 4 disk index)
// We yield between dates and skip ahead if RSS or event-loop lag breach the
// configured ceilings. Progress is written to state/warmup-progress.json.

function sleepMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

function measureLoopLag() {
  return new Promise((resolve) => {
    const t = Date.now();
    setImmediate(() => resolve(Date.now() - t));
  });
}

async function shouldSkipWarmupForGuardrails() {
  const rssMb = process.memoryUsage().rss / 1024 / 1024;
  if (cfg.warmupMaxRssMb > 0 && rssMb >= cfg.warmupMaxRssMb) {
    return { skip: true, reason: `rss=${rssMb.toFixed(0)}MB >= cap ${cfg.warmupMaxRssMb}MB` };
  }
  const lagMs = await measureLoopLag();
  if (cfg.warmupLagMs > 0 && lagMs >= cfg.warmupLagMs) {
    return { skip: true, reason: `loop-lag=${lagMs}ms >= cap ${cfg.warmupLagMs}ms` };
  }
  return { skip: false };
}

function persistWarmupProgress() {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    const file = resolve(STATE_DIR, 'warmup-progress.json');
    const tmp = file + '.tmp';
    writeFileSync(tmp, JSON.stringify({ ...warmupState, mode: daemonMode, persistedAt: new Date().toISOString() }));
    renameSync(tmp, file);
  } catch {}
}

async function runHistoricalWarmup() {
  if (!cfg.warmupEnabled || cfg.warmupDays === 0) {
    daemonMode = 'fully_warm';
    return;
  }
  daemonMode = 'warming_history';
  warmupState.startedAt = new Date().toISOString();
  warmupState.done = [];
  warmupState.skipped = [];
  warmupState.errors = [];
  persistWarmupProgress();

  // availableHistoryDates() is sorted newest-first.
  const dates = availableHistoryDates().filter((d) => d !== loadedDate).slice(0, cfg.warmupDays);
  console.log(`[warmup] starting day-by-day historical warmup for ${dates.length} dates: ${dates.join(', ') || '(none)'}`);

  for (const ymd of dates) {
    const guard = await shouldSkipWarmupForGuardrails();
    if (guard.skip) {
      warmupState.skipped.push({ date: ymd, reason: guard.reason });
      console.log(`[warmup] skip ${ymd}: ${guard.reason}`);
      persistWarmupProgress();
      // Wait before checking the next date so the system has a chance to
      // recover (GC, message-loop drain) before we try again.
      await sleepMs(2000);
      continue;
    }
    warmupState.current = ymd;
    persistWarmupProgress();
    const t0 = Date.now();
    try {
      // Prime caches by calling the same code paths that historical requests
      // hit. None of these throw on missing data — they just return null.
      getHistoricalTimetable(ymd);
      const snaps = listHistorySnapshotsForDate(ymd);
      buildSnapshotIndexForDate(ymd);
      getHistoricalContext(ymd);
      warmupState.done.push({ date: ymd, snapshots: snaps.length, ms: Date.now() - t0 });
      console.log(`[warmup] primed ${ymd} in ${Date.now() - t0}ms (${snaps.length} snapshots indexed)`);
    } catch (e) {
      warmupState.errors.push({ date: ymd, error: e.message });
      console.warn(`[warmup] failed ${ymd}: ${e.message}`);
    }
    persistWarmupProgress();
    // Yield generously between dates to keep the API responsive.
    await sleepMs(250);
  }

  warmupState.current = null;
  warmupState.finishedAt = new Date().toISOString();
  daemonMode = 'fully_warm';
  persistWarmupProgress();
  console.log(`[warmup] complete: done=${warmupState.done.length} skipped=${warmupState.skipped.length} errors=${warmupState.errors.length}`);
}

function persistState() {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    const savedAt = new Date().toISOString();
    const savedDate = loadedDate || railwayDayYmd(new Date());

    let formations = [...formationsByRid.entries()];
    let consistByRidArr = [...consistByRid.entries()];
    let unitsByIdArr = [...unitsById.entries()];

    let corePayload = {
      savedAt,
      savedDate,
      liveOverlayByRid: serializeLiveOverlayEntries(),
      cancelled: [...cancelled.entries()],
      delayReason: [...delayReason.entries()],
      messagesById: [...messagesById.entries()],
      stationMessages: [...stationMessages.entries()].map(([k, v]) => [k, [...v]]),
      associations: [...associationsByRid.entries()],
      alerts: [...alertsByRid.entries()],
      reverseFormation: [...reverseFormation],
      unmatchedConsists: [...unmatchedConsists.entries()],
      stateSchema: 2,
    };

    const mergedForScore = {
      ...corePayload,
      formations,
      consistByRid: consistByRidArr,
      unitsById: unitsByIdArr,
    };

    if (PROTECT_RICHER_STATE && existsSync(STATE_FILE)) {
      try {
        const diskMerged = readMergedStateFromDisk();
        if (diskMerged) {
          const diskScore = stateScore(diskMerged);
          const nextScore = stateScore(mergedForScore);
          if (diskScore > nextScore * 1.2) {
            console.warn(`[daemon] skip persist: on-disk cache looks richer (${diskScore} > ${nextScore}).`);
            const split = splitMergedForPersist(diskMerged);
            corePayload = split.core;
            if (!corePayload.savedAt) corePayload.savedAt = savedAt;
            if (!corePayload.savedDate) corePayload.savedDate = savedDate;
            formations = split.formations;
            consistByRidArr = split.consistByRid;
            unitsByIdArr = split.unitsById;
          }
        }
      } catch {}
    }

    // Write formations/consist/units shards before stringifying the core. The core
    // still embeds liveOverlayByRid and can hit V8's max string length; if
    // JSON.stringify throws we previously skipped shards entirely and coach data
    // vanished from disk until the next successful persist.
    const mainHeavyStem = heavyStemForCore(STATE_FILE);
    writeHeavyShardsAtomic(mainHeavyStem, formations, consistByRidArr, unitsByIdArr);

    let coreJson;
    try {
      coreJson = JSON.stringify(corePayload);
    } catch (e) {
      console.warn(`[daemon] failed to stringify core state (${e.message}); heavy shards updated, core/history snapshots skipped`);
      historicalStateFileCache.clear();
      lastPersistAt = new Date().toISOString();
      return;
    }

    const tmpMain = STATE_FILE + '.tmp';
    writeFileSync(tmpMain, coreJson);
    renameSync(tmpMain, STATE_FILE);

    if (!existsSync(STATE_HISTORY_DIR)) mkdirSync(STATE_HISTORY_DIR, { recursive: true });
    const dayDir = resolve(STATE_HISTORY_DIR, corePayload.savedDate);
    if (!existsSync(dayDir)) mkdirSync(dayDir, { recursive: true });

    const dayLatest = resolve(dayDir, 'daemon-cache.latest.json');
    const dayLatestTmp = dayLatest + '.tmp';
    writeFileSync(dayLatestTmp, coreJson);
    renameSync(dayLatestTmp, dayLatest);
    writeHeavyShardsAtomic(heavyStemForCore(dayLatest), formations, consistByRidArr, unitsByIdArr);

    const dayStamp = (corePayload.savedAt || savedAt).replace(/[:.]/g, '-');
    const stampedStem = resolve(dayDir, `daemon-cache-heavy.${dayStamp}`);
    if (STATE_HISTORY_COMPRESS_SNAPSHOTS) {
      const daySnap = resolve(dayDir, `daemon-cache.${dayStamp}.json.gz`);
      const daySnapTmp = daySnap + '.tmp';
      try {
        writeFileSync(daySnapTmp, gzipSync(coreJson, { level: STATE_HISTORY_GZIP_LEVEL }));
        renameSync(daySnapTmp, daySnap);
      } catch {}
    } else {
      const daySnap = resolve(dayDir, `daemon-cache.${dayStamp}.json`);
      const daySnapTmp = daySnap + '.tmp';
      try {
        writeFileSync(daySnapTmp, coreJson);
        renameSync(daySnapTmp, daySnap);
      } catch {}
    }
    try {
      writeHeavyShardsAtomic(stampedStem, formations, consistByRidArr, unitsByIdArr);
    } catch {}

    pruneHistoryDirsByRetention();
    try { buildSnapshotIndexForDate(corePayload.savedDate); } catch {}

    if (STATE_SNAPSHOT_COUNT > 0) {
      const stamp = (corePayload.savedAt || savedAt).replace(/[:.]/g, '-');
      const snap = resolve(STATE_DIR, `daemon-cache.${stamp}.json`);
      try {
        const snapTmp = snap + '.tmp';
        writeFileSync(snapTmp, coreJson);
        renameSync(snapTmp, snap);
        writeHeavyShardsAtomic(heavyStemForCore(snap), formations, consistByRidArr, unitsByIdArr);
        pruneOldStateSnapshots();
      } catch {}
    }
    historicalStateFileCache.clear();
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
        if (dep) {
          entry.bestTime = dep.time;
          entry.bestKind = dep.kind;
          entry.liveSource = dep.source || null;
          entry.liveSourceInstance = dep.sourceInstance || null;
          entry.unknownDelay = !!dep.unknownDelay;
          entry.manualUnknownDelay = !!dep.manualUnknownDelay;
          stats.updates++;
        }

        const arrTs = describeLiveTime(loc?.arr, 'actual-arr', 'est-arr');
        if (arrTs) {
          entry.arrLiveTime = arrTs.time;
          entry.arrLiveKind = arrTs.kind;
          entry.arrLiveSource = arrTs.source || null;
          entry.arrLiveSourceInstance = arrTs.sourceInstance || null;
          entry.arrUnknownDelay = !!arrTs.unknownDelay;
          entry.arrManualUnknownDelay = !!arrTs.manualUnknownDelay;
          stats.updates++;
        }

        // plat in JSON feed: { platsrc, conf, "": "3A" }
        if (loc.plat != null) {
          const platStr = typeof loc.plat === 'string' ? loc.plat
            : (loc.plat[''] || loc.plat['#text'] || loc.plat._);
          if (platStr && platStr !== entry.livePlat) { entry.livePlat = platStr; stats.updates++; }
          const platSrc = typeof loc.plat === 'object' ? (loc.plat.platsrc ? String(unwrap(loc.plat.platsrc)) : null) : null;
          const platConf = typeof loc.plat === 'object' ? (loc.plat.conf === true || loc.plat.conf === 'true') : false;
          const platSupp = typeof loc.plat === 'object' ? ((loc.plat.platsup === true || loc.plat.platsup === 'true') || (loc.plat.cisPlatsup === true || loc.plat.cisPlatsup === 'true')) : false;
          entry.platformSource = platSrc || null;
          entry.platformConfirmed = platConf;
          entry.platformSuppressed = platSupp;
        }
        if (loc.length != null) {
          const length = Number(unwrap(loc.length));
          entry.trainLength = Number.isFinite(length) && length > 0 ? length : null;
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
 * Convert a HH:MM string into minutes since midnight; returns null on bad input.
 */
function parseHHMM(s) {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function mergeDefects(existing = [], incoming = []) {
  if (!Array.isArray(existing) || existing.length === 0) return Array.isArray(incoming) ? incoming : [];
  if (!Array.isArray(incoming) || incoming.length === 0) return existing;
  const out = [...existing];
  const seen = new Set(existing.map((d) => `${d?.code || ''}|${d?.description || ''}|${d?.status || ''}|${d?.location || ''}|${d?.maintenanceUid || ''}`));
  for (const d of incoming) {
    const key = `${d?.code || ''}|${d?.description || ''}|${d?.status || ''}|${d?.location || ''}|${d?.maintenanceUid || ''}`;
    if (seen.has(key)) continue;
    out.push(d);
    seen.add(key);
  }
  return out;
}

function mergeVehicle(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'defects') continue;
    if (v !== null && v !== undefined && v !== '') merged[k] = v;
  }
  merged.defects = mergeDefects(existing.defects, incoming.defects);
  return merged;
}

function mergeResourceGroups(existing = [], incoming = []) {
  if (!Array.isArray(existing) || existing.length === 0) return Array.isArray(incoming) ? incoming : [];
  if (!Array.isArray(incoming) || incoming.length === 0) return existing;
  const out = existing.map((g) => ({ ...(g || {}), vehicles: [...(g?.vehicles || [])] }));
  const idxByKey = new Map();
  out.forEach((g, i) => {
    const key = `${g?.unitId || ''}|${g?.fleetId || ''}|${g?.position ?? ''}|${i}`;
    idxByKey.set(key, i);
  });
  incoming.forEach((ng, ngIdx) => {
    const key = `${ng?.unitId || ''}|${ng?.fleetId || ''}|${ng?.position ?? ''}|${ngIdx}`;
    const i = idxByKey.get(key);
    if (i == null) {
      out.push({ ...(ng || {}), vehicles: [...(ng?.vehicles || [])] });
      return;
    }
    const base = out[i] || {};
    const merged = { ...base };
    for (const [k, v] of Object.entries(ng || {})) {
      if (k === 'vehicles') continue;
      if (k === 'endOfDayMiles') {
        // Only update mileage when new value is present.
        if (v !== null && v !== undefined && v !== '') merged[k] = v;
        continue;
      }
      if (v !== null && v !== undefined && v !== '') merged[k] = v;
    }
    const existingVehicles = Array.isArray(base.vehicles) ? base.vehicles : [];
    const byVKey = new Map(existingVehicles.map((v, vi) => [`${v?.vehicleId || ''}|${v?.position ?? ''}|${vi}`, mergeVehicle(v, v)]));
    (ng?.vehicles || []).forEach((nv, vi) => {
      const vKey = `${nv?.vehicleId || ''}|${nv?.position ?? ''}|${vi}`;
      const ev = byVKey.get(vKey);
      byVKey.set(vKey, mergeVehicle(ev, nv));
    });
    merged.vehicles = [...byVKey.values()];
    out[i] = merged;
  });
  return out;
}

function mergeAllocations(existing = [], incoming = []) {
  if (!Array.isArray(existing) || existing.length === 0) return Array.isArray(incoming) ? incoming : [];
  if (!Array.isArray(incoming) || incoming.length === 0) return existing;
  const out = existing.map((a) => ({ ...(a || {}), resourceGroups: [...(a?.resourceGroups || [])] }));
  const idxByKey = new Map();
  out.forEach((a, i) => {
    const key = `${a?.allocationOriginDateTime || a?.trainOriginDateTime || ''}|${a?.allocationDestinationDateTime || a?.trainDestDateTime || ''}|${a?.resourceGroupPosition ?? ''}|${i}`;
    idxByKey.set(key, i);
  });
  incoming.forEach((na, nai) => {
    const key = `${na?.allocationOriginDateTime || na?.trainOriginDateTime || ''}|${na?.allocationDestinationDateTime || na?.trainDestDateTime || ''}|${na?.resourceGroupPosition ?? ''}|${nai}`;
    const i = idxByKey.get(key);
    if (i == null) {
      out.push({ ...(na || {}), resourceGroups: [...(na?.resourceGroups || [])] });
      return;
    }
    const base = out[i] || {};
    const merged = { ...base };
    for (const [k, v] of Object.entries(na || {})) {
      if (k === 'resourceGroups') continue;
      if (v !== null && v !== undefined && v !== '') merged[k] = v;
    }
    merged.resourceGroups = mergeResourceGroups(base.resourceGroups || [], na.resourceGroups || []);
    out[i] = merged;
  });
  return out;
}

/**
 * Map a parsed PTAC allocation message to a Darwin RID using the same join
 * rules as live ingestion (exact tuple, then loose + origin-time proximity).
 */
function resolveRidForParsedConsist(parsed) {
  const key = consistJoinKey(parsed);
  if (!key) return { rid: null, exactKey: null };
  const exact = `${key.ssd}|${key.headcode}|${key.originTpl}|${key.originHHMM}`;
  const loose = `${key.ssd}|${key.headcode}|${key.originTpl}`;

  let rid = ptacJoinByTuple?.get(exact);
  if (!rid) {
    const cands = ptacJoinByOrigin?.get(loose) || [];
    if (cands.length === 1) rid = cands[0];
    else if (cands.length > 1) {
      const target = parseHHMM(key.originHHMM);
      let best = null; let bestDelta = Infinity;
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
  return { rid: rid || null, exactKey: exact };
}

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

  const { rid, exactKey } = resolveRidForParsedConsist(parsed);
  if (!exactKey) { ptacStats.unmatched++; return; }

  if (!rid) {
    // Stash for later resolution — bounded to prevent unbounded growth.
    if (unmatchedConsists.size >= PTAC_UNMATCHED_CAP) {
      // Drop the oldest entry (Maps iterate in insertion order).
      const firstKey = unmatchedConsists.keys().next().value;
      if (firstKey) unmatchedConsists.delete(firstKey);
    }
    unmatchedConsists.set(exactKey, parsed);
    ptacStats.unmatched++;
    return;
  }

  ptacStats.matched++;
  applyConsistToRid(rid, parsed);
}

/**
 * Store the consist against a RID and update the unit-tracking index.
 * Always overwrites — latest broadcast wins, per the spec's "delete and
 * replace" semantics for repeated messages on the same train.
 */
function applyConsistToRid(rid, parsed) {
  const nowIso = new Date().toISOString();
  const mileageDay = parsed.allocations?.[0]?.diagramDate || loadedDate || railwayDayYmd(new Date());
  const prev = consistByRid.get(rid);
  const mergedAllocations = mergeAllocations(prev?.allocations || [], parsed.allocations || []);
  consistByRid.set(rid, {
    parsedAt: nowIso,
    company: parsed.company || prev?.company || null,
    companyDarwin: parsed.companyDarwin || prev?.companyDarwin || null,
    core: parsed.core || prev?.core || null,
    diagramDate: parsed.allocations?.[0]?.diagramDate || prev?.diagramDate || null,
    allocations: mergedAllocations,
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
        entry = {
          unitId: rg.unitId,
          fleetId: rg.fleetId,
          vehicles: rg.vehicles,
          services: [],
          endOfDayMileageByDate: {},
          lastEndOfDayMiles: null,
        };
        unitsById.set(rg.unitId, entry);
      } else {
        // Keep cached data and only patch in newly-seen fields/logs/vehicles.
        entry.fleetId = rg.fleetId || entry.fleetId;
        entry.vehicles = mergeResourceGroups(
          [{ vehicles: entry.vehicles || [] }],
          [{ vehicles: rg.vehicles || [], endOfDayMiles: rg.endOfDayMiles ?? null }]
        )[0]?.vehicles || entry.vehicles;
      }
      if (rg.endOfDayMiles != null) {
        if (!entry.endOfDayMileageByDate || typeof entry.endOfDayMileageByDate !== 'object') {
          entry.endOfDayMileageByDate = {};
        }
        entry.endOfDayMileageByDate[mileageDay] = rg.endOfDayMiles;
        entry.lastEndOfDayMiles = rg.endOfDayMiles;
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
      entry.updatedAt   = nowIso;
      mergeUnitIntoCatalog(entry);
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
    const { rid } = resolveRidForParsedConsist(parsed);
    if (rid) {
      applyConsistToRid(rid, parsed);
      unmatchedConsists.delete(k);
      resolved++;
    }
  }
  return resolved;
}

/** PTAC unit numbers for departures-board hints (no extra /api/service round-trip). */
function ptacUnitIdsFromConsist(consist) {
  if (!consist?.allocations?.length) return null;
  const ids = [];
  const seen = new Set();
  for (const a of consist.allocations) {
    for (const rg of a.resourceGroups || []) {
      const u = rg.unitId != null && String(rg.unitId).trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      ids.push(u);
    }
  }
  return ids.length ? ids : null;
}

// ---------- snapshot builder (per-TIPLOC, on demand) -----------------------
function buildDeparturesAndArrivalsForTiplocs(tiplocs, windowHours, ctx = null) {
  const byRidMap = ctx?.byRid || byRid;
  const byTiplocMap = ctx?.byTiploc || byTiploc;
  const liveOverlayMap = ctx?.liveOverlayByRid || liveOverlayByRid;
  const cancelledMap = ctx?.cancelled || cancelled;
  const delayMap = ctx?.delayReason || delayReason;
  const reverseSet = ctx?.reverseFormation || reverseFormation;
  const associationsMap = ctx?.associationsByRid || associationsByRid;
  const alertsMap = ctx?.alertsByRid || alertsByRid;
  const consistMap = ctx?.consistByRid || consistByRid;
  const formationsMap = ctx?.formationsByRid || formationsByRid;
  // tiplocs is an array — large interchanges share a CRS across multiple
  // TIPLOCs (e.g. STP = STPX [plat 1-4] + STPANCI [plat 5-13] + STPXBOX
  // [Thameslink low-level plat A]); a single CRS query must return all of
  // them. Single-TIPLOC queries pass a 1-element array.
  if (!Array.isArray(tiplocs) || tiplocs.length === 0) return null;

  const upper = tiplocs.map((t) => t.toUpperCase());
  const entries = [];
  let anyKnown = false;
  for (const tip of upper) {
    const list = byTiplocMap.get(tip);
    if (!list) continue;
    anyKnown = true;
    for (const e of list) entries.push({ ...e, sourceTpl: tip });
  }
  if (!anyKnown) return null;

  let now = new Date();
  if (ctx?.historicalDate) {
    if (ctx.boardWallDate && parseAtToMinutes(ctx.historicalAt || '') != null) {
      const w = londonWallInstantFromDateAt(ctx.boardWallDate, ctx.historicalAt);
      if (w) now = w;
    } else if (ctx.boardWallDate) {
      const w = londonWallInstantFromDateAt(ctx.boardWallDate, null);
      if (w) now = w;
    } else {
      const atMin = parseAtToMinutes(ctx.historicalAt || '');
      if (atMin != null) {
        const hh = String(Math.floor(atMin / 60)).padStart(2, '0');
        const mm = String(atMin % 60).padStart(2, '0');
        now = new Date(`${ctx.historicalDate}T${hh}:${mm}:00+01:00`);
      } else {
        now = new Date(`${ctx.historicalDate}T12:00:00+01:00`);
      }
    }
  }
  const ssdTarget =
    ctx?.historicalDate && ctx.historicalAt != null && ctx.boardWallDate
      ? railwayDayYmd(now)
      : (ctx?.historicalDate || railwayDayYmd(new Date()));
  const horizon = new Date(now.getTime() + windowHours * 3600_000);
  const todayRailwaySsd = railwayDayYmd(new Date());
  const isFutureTimetableCtx =
    !!ctx?.historicalDate && compareIsoDate(ctx.historicalDate, todayRailwaySsd) > 0;
  const allowSpansNextSsd =
    (!ctx || ctx.stateSavedAt == null) && !isFutureTimetableCtx;
  const ssdsNeeded = new Set([ssdTarget]);
  if (allowSpansNextSsd) {
    const horizonSsd = railwayDayYmd(horizon);
    if (horizonSsd !== ssdTarget) ssdsNeeded.add(horizonSsd);
  }

  const departures = [];
  const arrivals = [];
  const seenDepRid = new Set();
  const seenArrRid = new Set();

  for (const { rid, stopIdx, sourceTpl } of entries) {
    const j = byRidMap.get(rid);
    if (!j || !ssdsNeeded.has(j.ssd)) continue;
    const stop = j.slots[stopIdx];

    const ov = liveOverlayMap.get(rid);
    const liveLoc = getOverlayLoc(ov, sourceTpl);
    const wholeCancel = normalizeCancellationInfo(cancelledMap.get(rid) || null);
    const stopCancel = liveLoc?.cancelled
      ? (liveLoc.cancelReason
          ? { ...liveLoc.cancelReason, source: 'ts-loc', scope: 'stop' }
          : { reason: 'Cancelled at this stop', source: 'ts-loc', scope: 'stop' })
      : null;
    const cancelInfo = normalizeCancellationInfo(wholeCancel || stopCancel);
    const delayInfo = delayMap.get(rid) || null;

    const callingAfter = [];
    for (let i = stopIdx + 1; i < j.slots.length; i++) {
      const s = j.slots[i];
      if (s.slot === 'PP' || s.slot === 'OPPP') continue;
      callingAfter.push(s.tpl);
    }

    const serviceType = classifyServiceType({
      trainCat: j.trainCat,
      isPassenger: j.isPassenger,
      trainId: j.trainId,
      originName: resolve_.tiplocToName(j.origin),
      destinationName: resolve_.tiplocToName(j.destination),
    });

    const baseRow = () => ({
      rid: j.rid,
      trainId: j.trainId,
      uid: j.uid,
      toc: j.toc,
      tocName: resolve_.tocToName(j.toc),
      trainCat: j.trainCat || null,
      serviceType,
      origin: j.origin,
      originName: resolve_.tiplocToName(j.origin),
      originCrs: resolve_.tiplocToCrs(j.origin),
      destination: j.destination,
      destinationName: resolve_.tiplocToName(j.destination),
      destinationCrs: resolve_.tiplocToCrs(j.destination),
      callingAfter,
      callingAfterNames: callingAfter.map(resolve_.tiplocToName),
      callingAfterCrs: callingAfter.map(resolve_.tiplocToCrs),
      isPassenger: j.isPassenger,
      cancelled: cancelInfo ? true : false,
      cancellation: cancelInfo,
      delayReason: delayInfo,
      trainLength: liveLoc?.trainLength ?? null,
      platform: stop.plat,
      livePlatform: liveLoc?.livePlat || null,
      platformSource: liveLoc?.platformSource || null,
      platformConfirmed: !!liveLoc?.platformConfirmed,
      platformSuppressed: !!liveLoc?.platformSuppressed,
      loadingPercentage: liveLoc?.loadPct ?? null,
      coachLoading: liveLoc?.coachLoading ?? null,
      reverseFormation: reverseSet.has(rid),
      hasAssociations: (associationsMap.get(rid)?.length ?? 0) > 0,
      hasAlerts: (alertsMap.get(rid)?.length ?? 0) > 0,
      hasConsist: consistMap.has(rid),
      hasFormation: formationsMap.has(rid),
      formation: formationsMap.get(rid) || null,
      unitIds: ptacUnitIdsFromConsist(consistMap.get(rid)),
      sourceTiploc: sourceTpl,
    });

    // ----- Departures (skip pure terminating stops; TF marks termination) -----
    if (!seenDepRid.has(rid)) {
      const isPassing = stop.slot === 'PP' || stop.slot === 'OPPP';
      const skipDep = stop.slot === 'DT' || stop.slot === 'OPDT' || stop.act === 'TF';
      if (!skipDep) {
        const scheduledTime = isPassing ? (stop.wtp || stop.wtd) : (stop.ptd || stop.wtd);
        if (scheduledTime && scheduledTime.includes(':')) {
          let scheduledAt = anchorTime(scheduledTime, j.ssd);
          if (scheduledAt) {
            scheduledAt = adjustScheduledInstantForRailwayOvernight(scheduledAt, scheduledTime);
            if (scheduledAt.getTime() >= now.getTime() - 5 * 60_000 && scheduledAt <= horizon) {
              seenDepRid.add(rid);
              const unknownDelay = !!liveLoc?.unknownDelay;
              const manualUnknownDelay = !!liveLoc?.manualUnknownDelay;
              const bestTime = liveLoc?.bestTime || scheduledTime;
              const bestKind = liveLoc?.bestKind || 'scheduled';
              const delayMinutes = unknownDelay ? null : computeDelayMinutes(scheduledTime, bestTime, bestKind);
              departures.push({
                ...baseRow(),
                movement: 'departure',
                isPassing,
                scheduledTime,
                scheduledAt: scheduledAt.toISOString(),
                liveTime: bestTime,
                liveKind: bestKind,
                liveSource: liveLoc?.liveSource || null,
                liveSourceInstance: liveLoc?.liveSourceInstance || null,
                unknownDelay,
                manualUnknownDelay,
                delayMinutes,
                status: cancelInfo
                  ? 'CANCELLED'
                  : unknownDelay
                    ? 'delayed'
                    : delayMinutes == null
                      ? ((bestKind === 'scheduled' || bestKind === 'working') ? 'on time' : `${bestKind} ${bestTime}`)
                      : (delayMinutes === 0 ? 'on time' : `${bestKind} ${bestTime} (${delayMinutes > 0 ? '+' : ''}${delayMinutes}m)`),
              });
            }
          }
        }
      }
    }

    // ----- Arrivals (terminators + intermediate stops with public/working arr) -----
    if (!seenArrRid.has(rid)) {
      const slot = stop.slot;
      const arrivalEligible =
        slot === 'DT' || slot === 'OPDT'
        || slot === 'IP' || slot === 'OPIP';
      if (arrivalEligible) {
        const scheduledTime = (slot === 'DT' || slot === 'OPDT')
          ? (stop.pta || stop.wta || stop.ptd || stop.wtd)
          : (stop.pta || stop.wta || stop.ptd || stop.wtd);
        if (scheduledTime && scheduledTime.includes(':')) {
          let scheduledAt = anchorTime(scheduledTime, j.ssd);
          if (scheduledAt) {
            scheduledAt = adjustScheduledInstantForRailwayOvernight(scheduledAt, scheduledTime);
            if (scheduledAt.getTime() >= now.getTime() - 5 * 60_000 && scheduledAt <= horizon) {
              seenArrRid.add(rid);
              const unknownDelay = !!(liveLoc?.arrUnknownDelay ?? liveLoc?.unknownDelay);
              const manualUnknownDelay = !!(liveLoc?.arrManualUnknownDelay ?? liveLoc?.manualUnknownDelay);
              const bestTime = (liveLoc?.arrLiveTime != null && liveLoc.arrLiveTime !== '')
                ? liveLoc.arrLiveTime
                : scheduledTime;
              const bestKind = liveLoc?.arrLiveKind || 'scheduled';
              const delayMinutes = unknownDelay ? null : computeDelayMinutes(scheduledTime, bestTime, bestKind);
              arrivals.push({
                ...baseRow(),
                movement: 'arrival',
                isPassing: false,
                scheduledTime,
                scheduledAt: scheduledAt.toISOString(),
                liveTime: bestTime,
                liveKind: bestKind,
                liveSource: liveLoc?.arrLiveSource ?? liveLoc?.liveSource ?? null,
                liveSourceInstance: liveLoc?.arrLiveSourceInstance ?? liveLoc?.liveSourceInstance ?? null,
                unknownDelay,
                manualUnknownDelay,
                delayMinutes,
                status: cancelInfo
                  ? 'CANCELLED'
                  : unknownDelay
                    ? 'delayed'
                    : delayMinutes == null
                      ? ((bestKind === 'scheduled' || bestKind === 'working') ? 'on time' : `${bestKind} ${bestTime}`)
                      : (delayMinutes === 0 ? 'on time' : `${bestKind} ${bestTime} (${delayMinutes > 0 ? '+' : ''}${delayMinutes}m)`),
              });
            }
          }
        }
      }
    }
  }

  departures.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  arrivals.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return { departures, arrivals };
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

function buildSnapshot(tiplocs, windowHours, primaryTiploc, ctx = null) {
  const all = Array.isArray(tiplocs) ? tiplocs : [tiplocs];
  const primary = (primaryTiploc || all[0]).toUpperCase();
  const built = buildDeparturesAndArrivalsForTiplocs(all, windowHours, ctx);
  if (built === null) return null;
  const { departures: rows, arrivals: arrRows } = built;
  const stationCrs = resolve_.tiplocToCrs(primary);
  const messages = stationCrs ? listMessagesForCrs(stationCrs) : [];
  const combined = [...rows, ...arrRows];
  return {
    tiploc: primary,
    // When the station spans several TIPLOCs, expose the full set so the
    // caller (and the website) can see what's been merged.
    tiplocs: all.length > 1 ? all : undefined,
    stationName: resolve_.tiplocToName(primary),
    stationCrs,
    updatedAt: new Date().toISOString(),
    historicalDate: ctx?.historicalDate || null,
    historicalAt: ctx?.historicalAt || null,
    historicalSavedAt: ctx?.stateSavedAt || null,
    wallClockDate: ctx?.boardWallDate || null,
    timetableFile: timetablePath.split('/').pop(),
    windowHours,
    counts: {
      departures: rows.length,
      arrivals: arrRows.length,
      cancelled: combined.filter((r) => r.cancelled).length,
      withDelay: combined.filter((r) => r.delayReason).length,
      messages: messages.length,
    },
    messages,
    kafka: {
      consumed: stats.consumed,
      updatesApplied: stats.updates,
      startedAt: stats.startedAt,
      lastMessageAt: stats.lastKafkaMsgAt,
    },
    departures: rows,
    arrivals: arrRows,
  };
}

function getCachedSnapshot(cacheKey) {
  const hit = departuresCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAtMs) {
    departuresCache.delete(cacheKey);
    return null;
  }
  return hit.snapshot;
}

function putCachedSnapshot(cacheKey, snapshot, ttlMs = null) {
  const ttl = ttlMs ?? cfg.departuresCacheMs;
  if (ttl <= 0) return;
  departuresCache.set(cacheKey, {
    expiresAtMs: Date.now() + ttl,
    snapshot,
  });
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
function buildServiceDetail(rid, ctx = null) {
  const byRidMap = ctx?.byRid || byRid;
  const liveOverlay = ctx?.liveOverlayByRid || liveOverlayByRid;
  const cancelledMap = ctx?.cancelled || cancelled;
  const delayMap = ctx?.delayReason || delayReason;
  const reverseSet = ctx?.reverseFormation || reverseFormation;
  const formationsMap = ctx?.formationsByRid || formationsByRid;
  const consistMap = ctx?.consistByRid || consistByRid;
  const assocMap = ctx?.associationsByRid || associationsByRid;
  const alertsMap = ctx?.alertsByRid || alertsByRid;
  const j = byRidMap.get(rid);
  if (!j) return null;
  const ov = liveOverlay.get(rid);
  const cancelInfo = normalizeCancellationInfo(cancelledMap.get(rid) || null);
  const delayInfo  = delayMap.get(rid) || null;

  function resolveStopName(tpl, crs) {
    const direct = resolve_.tiplocToName(tpl);
    if (direct && direct.toUpperCase() !== tpl.toUpperCase()) return direct;
    if (!crs) return null;
    const candidates = crsToTiplocs.get(String(crs).toUpperCase()) || [];
    for (const candidateTpl of candidates) {
      const n = resolve_.tiplocToName(candidateTpl);
      if (n && n.toUpperCase() !== candidateTpl.toUpperCase()) return n;
    }
    return null;
  }

  const baseStops = j.slots.map((s) => {
    const live = getOverlayLoc(ov, s.tpl);
    const crs = resolve_.tiplocToCrs(s.tpl);
    return {
      tpl: s.tpl,
      name: resolveStopName(s.tpl, crs),
      crs,
      slot: s.slot,                          // OR / IP / PP / DT / OPxx
      pta:  s.pta,
      ptd:  s.ptd,
      wta:  s.wta,
      wtd:  s.wtd,
      wtp:  s.wtp,
      platform: s.plat,
      livePlatform: live?.livePlat || null,
      platformSource: live?.platformSource || null,
      platformConfirmed: !!live?.platformConfirmed,
      platformSuppressed: !!live?.platformSuppressed,
      activity: s.act,
      liveTime: live?.bestTime || null,
      liveKind: live?.bestKind || null,
      liveSource: live?.liveSource || null,
      liveSourceInstance: live?.liveSourceInstance || null,
      unknownDelay: !!live?.unknownDelay,
      manualUnknownDelay: !!live?.manualUnknownDelay,
      trainLength: live?.trainLength ?? null,
      cancelledAtStop: live?.cancelled || false,
      cancelReasonAtStop: live?.cancelReason || null,
      // Loading at this stop (if Darwin published it): overall % and/or
      // per-coach 1–10 enum. Null means no live loading data yet.
      loadingPercentage: live?.loadPct ?? null,
      coachLoading: live?.coachLoading ?? null,
    };
  });

  const stops = baseStops;

  // A "partial cancellation" is when the whole service isn't cancelled but
  // one or more individual stops are. The UI uses this to show a banner
  // explaining the situation alongside per-stop strikethroughs.
  const partiallyCancelled = !cancelInfo && stops.some((s) => s.cancelledAtStop);

  // Resolve associated services to human-readable summaries. We only look up
  // basic info on the *other* RID — full traversal can be done by the client
  // by following the RID into another /api/service/:rid call.
  const associations = (assocMap.get(rid) || []).map((a) => {
    const otherRid = a.mainRid === rid ? a.assocRid : a.mainRid;
    const other = byRidMap.get(otherRid);
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
    reverseFormation: reverseSet.has(rid),
    formation:    formationsMap.get(rid) || null,
    // PTAC consist (physical reality view): unit numbers, vehicles, defects,
    // class identification. Null when no PTAC message has been received for
    // this RID yet (most regional services + LNER don't publish to PTAC).
    consist:      consistMap.get(rid) || null,
    associations,
    alerts:       alertsMap.get(rid) || [],
    stops,
    updatedAt: new Date().toISOString(),
  };
}

// ---------- HTTP server ----------------------------------------------------
function pickCorsOrigin(req) {
  if (cfg.corsOrigins.includes('*')) return '*';
  const origin = req.headers.origin;
  if (origin) {
    if (cfg.corsOrigins.includes(origin)) return origin;
    // Allow controlled wildcard entries like https://*.railstatistics.co.uk
    for (const allowed of cfg.corsOrigins) {
      if (!allowed.includes('*')) continue;
      const wildcard = allowed.match(/^(https?:\/\/)\*\.([^/:]+)(:\d+)?$/i);
      if (!wildcard) continue;
      const [, proto, rootHost, portPart = ''] = wildcard;
      const originMatch = origin.match(/^(https?:\/\/)([^/:]+)(:\d+)?$/i);
      if (!originMatch) continue;
      const [, originProto, originHost, originPort = ''] = originMatch;
      if (originProto.toLowerCase() !== proto.toLowerCase()) continue;
      if (originPort !== portPart) continue;
      if (originHost.toLowerCase() === rootHost.toLowerCase()) continue;
      if (originHost.toLowerCase().endsWith(`.${rootHost.toLowerCase()}`)) return origin;
    }
    // Browser-origin request, but not allow-listed.
    return null;
  }
  // Non-browser/no-origin requests (CLI/health checks).
  return cfg.corsOrigins[0] || 'http://localhost:3000';
}
/** Env: DARWIN_CLIENT_READY_AFTER=restored (default) | warm — when warm, block until historical warmup finishes too. */
function clientReadsAllowed() {
  const policy = String(process.env.DARWIN_CLIENT_READY_AFTER || 'restored').trim().toLowerCase();
  if (policy === 'warm' || policy === 'fully_warm' || policy === 'full') {
    return daemonMode === 'fully_warm';
  }
  return liveCachesReady;
}

function sendJson(res, status, body, req) {
  const json = JSON.stringify(body, null, 2);
  const cors = pickCorsOrigin(req);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (cors) headers['Access-Control-Allow-Origin'] = cors;
  res.writeHead(status, {
    ...headers,
  });
  res.end(json);
}

function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    const cors = pickCorsOrigin(req);
    const headers = {
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (cors) headers['Access-Control-Allow-Origin'] = cors;
    res.writeHead(204, {
      ...headers,
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
  // Optional API-key auth guard. When INTERNAL_API_KEY is set, every request
  // must include matching X-API-Key.
  if (cfg.internalApiKeys.length > 0) {
    const presented = (req.headers['x-api-key'] || '').toString().trim();
    if (!cfg.internalApiKeys.includes(presented)) {
      sendJson(res, 401, { error: 'unauthorized' }, req);
      return;
    }
  }

  const isHealth = parts.length === 2 && parts[0] === 'api' && parts[1] === 'health';
  if (!isHealth && !clientReadsAllowed()) {
    sendJson(res, 503, {
      ok: false,
      error: 'starting',
      mode: daemonMode,
      liveCachesReady,
      retryAfterSec: 3,
      hint: 'Caches still loading after startup; retry shortly.',
    }, req);
    return;
  }

  // /api/health
  if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'health') {
    const mem = process.memoryUsage();
    sendJson(res, 200, {
      ok: true,
      mode: daemonMode,
      liveCachesReady,
      clientReadsAllowed: clientReadsAllowed(),
      clientReadyPolicy: process.env.DARWIN_CLIENT_READY_AFTER || 'restored',
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
      unitCatalog: { file: UNIT_CATALOG_FILE, size: unitCatalogById.size, lastPersistAt: lastUnitCatalogPersistAt },
      history: {
        dir: STATE_HISTORY_DIR,
        dates: availableHistoryDates().slice(0, 30),
        retentionDays: STATE_HISTORY_RETENTION_DAYS,
        pruneOnPersist: STATE_HISTORY_PRUNE_ON_PERSIST,
        cacheTuning: {
          timetableTtlMs: HIST_TIMETABLE_CACHE_TTL_MS,
          timetableMax: HIST_TIMETABLE_CACHE_MAX,
          contextTtlMs: HIST_CONTEXT_CACHE_TTL_MS,
          contextMax: HIST_CONTEXT_CACHE_MAX,
          stateFileTtlMs: HIST_STATE_FILE_CACHE_TTL_MS,
          stateFileMax: HIST_STATE_FILE_CACHE_MAX,
          snapshotListTtlMs: HIST_SNAPSHOT_LIST_CACHE_TTL_MS,
        },
      },
      warmup: {
        enabled: cfg.warmupEnabled,
        days: cfg.warmupDays,
        startedAt: warmupState.startedAt,
        finishedAt: warmupState.finishedAt,
        current: warmupState.current,
        done: warmupState.done.length,
        skipped: warmupState.skipped.length,
        errors: warmupState.errors.length,
        guardrails: { maxRssMb: cfg.warmupMaxRssMb, lagMs: cfg.warmupLagMs },
      },
      rawArchive: {
        enabled: cfg.rawArchiveEnabled,
        dir: cfg.rawArchiveDir,
        retentionDays: cfg.rawArchiveRetentionDays,
      },
      departuresCacheMs: {
        live: cfg.departuresCacheMs,
        historical: cfg.departuresHistCacheMs,
      },
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
    const dateParam = url.searchParams.get('date');
    const atParam = url.searchParams.get('at');
    const hours = Math.max(0.25, Math.min(24, Number(hoursParam || cfg.windowHours)));
    if (dateParam && !isIsoDate(dateParam)) {
      sendJson(res, 400, { error: 'invalid date format', hint: 'use YYYY-MM-DD' }, req); return;
    }
    if (atParam && parseAtToMinutes(atParam) == null) {
      sendJson(res, 400, { error: 'invalid at format', hint: 'use HH:MM' }, req); return;
    }
    const loadedDay = loadedDate || railwayDayYmd(new Date());
    const wallInstant = dateParam ? londonWallInstantFromDateAt(dateParam, atParam || null) : null;
    const anchorDay = wallInstant ? railwayDayYmd(wallInstant) : null;
    const dateComparison = anchorDay ? compareIsoDate(anchorDay, loadedDay) : 0;
    const isHistorical = !!dateParam && dateComparison < 0;
    const isTimedCurrentDay = !!dateParam && dateComparison === 0 && !!atParam;
    const isFutureTimetable = !!dateParam && dateComparison > 0;
    if (isFutureTimetable) {
      const maxFutureDate = addDaysIsoDate(loadedDay, 2);
      if (compareIsoDate(anchorDay || dateParam, maxFutureDate) > 0) {
        sendJson(res, 400, { error: 'future date out of range', hint: `max supported future date is ${maxFutureDate}` }, req); return;
      }
    }
    const cacheKey = `${resolved.tiplocs.join(',')}|${hours}|${dateParam || ''}|${atParam || ''}`;
    const cached = getCachedSnapshot(cacheKey);
    if (cached) {
      sendJson(res, 200, cached, req);
      return;
    }
    // Pass the FULL set of TIPLOCs that share this CRS so a station with
    // multiple platform groups (St Pancras, Edinburgh, etc.) returns all
    // its departures, not just one platform group.
    const loadDate = anchorDay || dateParam;
    let queryCtx = null;
    if (isHistorical) {
      queryCtx = getHistoricalContext(loadDate, atParam);
      if (!queryCtx) {
        sendJson(res, 404, { error: `no historical data for ${loadDate}` }, req); return;
      }
    } else if (isTimedCurrentDay) {
      queryCtx = getLiveTimedContext(loadDate, atParam);
      if (!queryCtx) {
        sendJson(res, 404, { error: `no live context for ${loadDate}` }, req); return;
      }
    } else if (isFutureTimetable) {
      queryCtx = getTimetableOnlyContext(loadDate, atParam);
      if (!queryCtx) {
        sendJson(res, 404, { error: `no timetable data for ${loadDate}` }, req); return;
      }
    }
    if (queryCtx && dateParam) queryCtx.boardWallDate = dateParam;
    const snap = buildSnapshot(resolved.tiplocs, hours, resolved.tiploc, queryCtx);
    if (!snap) { sendJson(res, 404, { error: `no services indexed for ${resolved.tiploc}` }, req); return; }
    snap.stationName = resolved.name || snap.stationName;
    snap.stationCrs  = resolved.crs  || snap.stationCrs;
    snap.matchedAs   = resolved.matchedAs;
    if (resolved.alternates) snap.alternates = resolved.alternates;
    const histTtl = isHistorical ? cfg.departuresHistCacheMs : cfg.departuresCacheMs;
    putCachedSnapshot(cacheKey, snap, histTtl);
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
    const dateParam = url.searchParams.get('date');
    const atParam = url.searchParams.get('at');
    if (dateParam && (dateParam !== loadedDate || !!atParam)) {
      if (!isIsoDate(dateParam)) {
        sendJson(res, 400, { error: 'invalid date format', hint: 'use YYYY-MM-DD' }, req);
        return;
      }
      if (atParam && parseAtToMinutes(atParam) == null) {
        sendJson(res, 400, { error: 'invalid at format', hint: 'use HH:MM' }, req);
        return;
      }
      const histCtx = getHistoricalContext(dateParam, atParam);
      if (!histCtx) {
        sendJson(res, 404, { error: `no historical data for ${dateParam}` }, req);
        return;
      }
      // Timed views for the *current* timetable day still build overlays from the
      // persisted snapshot, but Darwin formations + PTAC consists stream in live
      // and may not be present in that snapshot (persist can skip or fail when
      // the JSON payload is huge). Use in-memory caches for coach/consist data.
      const liveDay = loadedDate || railwayDayYmd(new Date());
      const detailCtx =
        dateParam === liveDay
          ? { ...histCtx, formationsByRid, consistByRid }
          : histCtx;
      const hist = buildServiceDetail(parts[2], detailCtx);
      if (!hist) {
        sendJson(res, 404, { error: `rid not found for ${dateParam}: "${parts[2]}"` }, req);
        return;
      }
      sendJson(res, 200, { ...hist, historicalDate: dateParam, historicalSavedAt: histCtx.stateSavedAt || null, historicalAt: atParam || null }, req);
      return;
    }
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

  // /api/units/catalog?fleet=158
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'units' && parts[2] === 'catalog') {
    const fleetFilter = (url.searchParams.get('fleet') || '').trim().toUpperCase();
    const units = [...unitCatalogById.values()]
      .filter((u) => !fleetFilter || String(u.fleetId || '').toUpperCase().includes(fleetFilter))
      .sort((a, b) => String(a.unitId || '').localeCompare(String(b.unitId || '')));
    const fleets = new Map();
    for (const u of units) {
      const f = (u.fleetId || 'unknown').toString();
      if (!fleets.has(f)) fleets.set(f, { fleetId: f, unitCount: 0 });
      fleets.get(f).unitCount += 1;
    }
    sendJson(res, 200, {
      count: units.length,
      fleetFilter: fleetFilter || null,
      fleets: [...fleets.values()].sort((a, b) => a.fleetId.localeCompare(b.fleetId)),
      units,
      updatedAt: new Date().toISOString(),
    }, req);
    return;
  }

  // /api/history/dates
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'history' && parts[2] === 'dates') {
    const dates = availableHistoryDates().map((d) => ({
      date: d,
      hasState: existsSync(historyFileForDate(d)),
      hasTimetable: !!pickTimetableForDate(d),
      snapshots: listHistorySnapshotsForDate(d).map((s) => s.savedAt).filter(Boolean).slice(-24),
    }));
    sendJson(res, 200, {
      count: dates.length,
      retentionDays: STATE_HISTORY_RETENTION_DAYS,
      pruneOnPersist: STATE_HISTORY_PRUNE_ON_PERSIST,
      dates,
      updatedAt: new Date().toISOString(),
    }, req);
    return;
  }

  // /api/history/overlay-series?hours=36
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === 'history' && parts[2] === 'overlay-series') {
    const hoursParam = Number(url.searchParams.get('hours') || '36');
    sendJson(res, 200, buildOverlayHistorySeries(hoursParam), req);
    return;
  }

  sendJson(res, 404, { error: 'not found', hint: 'try /api/health, /api/station/:code, /api/departures/:code, /api/messages/:crs, /api/service/:rid?date=YYYY-MM-DD, /api/unit/:id, /api/units/catalog, /api/history/dates, /api/history/overlay-series' }, req);
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
  persistUnitCatalog();
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

  // Replay window — rolling minutes from now, or SSD-calendar 00:01 London for backfill (PTAC_REPLAY_ANCHOR).
  let replayOffsets = null;
  let sinceMs = null;
  let replayLabel = '';
  if (ptacCfg.replayAnchor === 'ssd_0001') {
    const ssd = railwayDayYmd(new Date());
    sinceMs = ssdLondonCalendar001UtcMs(ssd);
    replayLabel = `anchor=ssd_0001 SSD=${ssd} since=${new Date(sinceMs).toISOString()}`;
  } else if (ptacCfg.initialReplay > 0) {
    sinceMs = Date.now() - ptacCfg.initialReplay * 60_000;
    replayLabel = `anchor=rolling -${ptacCfg.initialReplay} min since=${new Date(sinceMs).toISOString()}`;
  }
  if (sinceMs != null) {
    const admin = ptacKafka.admin();
    try {
      await admin.connect();
      replayOffsets = await admin.fetchTopicOffsetsByTimestamp(ptacCfg.topic, sinceMs);
      console.log(`[ptac] will replay (${replayLabel}) across ${replayOffsets.length} partition(s).`);
    } catch (e) { console.warn(`[ptac] offset fetch failed: ${e.message}`); }
    finally { await admin.disconnect(); }
  }

  let pendingReplaySeek = replayOffsets;
  ptacConsumer.on(ptacConsumer.events.GROUP_JOIN, () => {
    if (!pendingReplaySeek?.length) return;
    const toSeek = pendingReplaySeek;
    pendingReplaySeek = null;
    setImmediate(() => {
      for (const o of toSeek) {
        try {
          ptacConsumer.seek({ topic: ptacCfg.topic, partition: o.partition, offset: o.offset });
        } catch (e) {
          console.warn(`[ptac] seek p${o.partition} failed: ${e.message}`);
        }
      }
      console.log('[ptac] startup replay seek applied.');
    });
  });

  ptacConsumer.run({
    eachMessage: async ({ message }) => {
      archiveRawFeed('ptac', message.value);
      try { processConsistMessage(message.value); }
      catch (e) { /* don't die on one bad message */ ptacStats.errors++; }
    },
  }).catch((e) => {
    console.error('[ptac] consumer.run error:', e);
    // Don't shutdown — keep Darwin running even if PTAC dies.
    ptacConsumer = null;
  });

  console.log('[ptac] consumer running.');
}

async function start() {
  daemonMode = 'cold_starting';
  if (cfg.autoFetchFiles) {
    await runDailyFileFetch('startup');
  } else {
    console.log('[daemon] auto-fetch disabled (DARWIN_AUTO_FETCH_FILES=false).');
  }

  reloadReferenceData();

  // Live-first startup (Phase 2): apply only the small, high-value subset of
  // persisted state synchronously so /api/departures and /api/service can
  // give correct answers within seconds of restart. The larger long-lived
  // caches (formations, NRCC messages, PTAC consists, units) are restored
  // asynchronously after server.listen() completes, then the warmup task
  // walks the last N days of history.
  const persistedRaw = readPersistedStateRawIfFresh();
  applyPersistedStateLive(persistedRaw);
  loadUnitCatalog();
  for (const unit of unitsById.values()) mergeUnitIntoCatalog(unit);
  persistUnitCatalog();

  server.listen(cfg.port, () => {
    daemonMode = 'live_ready';
    console.log(`[daemon] HTTP API listening on http://localhost:${cfg.port} (mode=${daemonMode})`);
    console.log(`[daemon]   GET /api/health`);
    console.log(`[daemon]   GET /api/station/:code`);
    console.log(`[daemon]   GET /api/departures/:code?hours=N   (default ${cfg.windowHours})`);
    console.log(`[daemon]   GET /api/messages/:crs`);
    console.log(`[daemon]   GET /api/service/:rid`);
    console.log(`[daemon]   GET /api/unit/:resourceGroupId`);
    console.log(`[daemon]   GET /api/units/catalog?fleet=158`);
  });

  // Background restore + warmup. setImmediate keeps the start() promise
  // moving so consumer.connect() below can run in parallel.
  setImmediate(async () => {
    try {
      const t0 = Date.now();
      applyPersistedStateRest(persistedRaw);
      console.log(`[daemon] background restore (rest of caches) finished in ${Date.now() - t0}ms`);
    } catch (e) {
      console.warn(`[daemon] background restore failed: ${e.message}`);
    } finally {
      liveCachesReady = true;
    }
    // PTAC after disk restore so replay isn't overwritten by persisted consists,
    // and join keys from timetable are already loaded.
    startPtacConsumer().catch((e) => console.warn('[ptac] start failed:', e.message));
    try {
      await runHistoricalWarmup();
    } catch (e) {
      console.warn(`[daemon] background warmup failed: ${e.message}`);
      daemonMode = 'fully_warm';
    }
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
      archiveRawFeed('darwin', message.value);
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
    console.log(
      `[daemon] heartbeat: darwin consumed=${stats.consumed} updates=${stats.updates} live=${liveOverlayByRid.size} cancelled=${cancelled.size} formations=${formationsByRid.size}`
      + ` | ptac consumed=${ptacStats.consumed} matched=${ptacStats.matched} unmatched=${unmatchedConsists.size} consists=${consistByRid.size} units=${unitsById.size}`
      + ` | heap=${(mem.heapUsed/1024/1024).toFixed(0)}MB`
    );
  }, cfg.heartbeat * 1000);

  // Persist long-lived caches on a regular timer so a crash or kill -9 still
  // leaves us at most PERSIST_INTERVAL_SEC of new data behind.
  setInterval(persistState, PERSIST_INTERVAL_SEC * 1000);
  setInterval(persistUnitCatalog, PERSIST_INTERVAL_SEC * 1000);

  // Day rollover: every 5 min, check the date.
  setInterval(() => {
    const t = railwayDayYmd(new Date());
    if (t !== loadedDate) {
      console.log(`[daemon] day rollover detected (${loadedDate} → ${t}), reloading reference data ...`);
      try {
        reloadAllDataAndResetLive('day rollover');
      } catch (e) {
        console.warn(`[daemon] reload failed (will retry in 5 min): ${e.message}`);
      }
    }
  }, 5 * 60_000);

  // Daily timetable file auto-fetch at configured local time (default 04:05).
  // Runs once per date while daemon is alive.
  setInterval(() => {
    maybeRunScheduledAutoFetch().catch((e) => {
      console.warn(`[daemon] scheduled auto-fetch failed: ${e.message}`);
    });
  }, 60_000);
}

start().catch((e) => { console.error('[daemon] fatal:', e); process.exit(1); });
