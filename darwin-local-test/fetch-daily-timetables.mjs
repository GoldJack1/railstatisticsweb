#!/usr/bin/env node
/**
 * Downloads Darwin PPTimetable files into ./tt/YYYYMMDD/ for the **UK railway operating day**
 * (same 02:00 Europe/London boundary as departures-daemon.mjs — not raw server calendar date).
 * When scheduled from cron, run as the same UNIX user as darwin-daemon (railstats)
 * so files under tt/ are readable; root cron causes permission failures at rollover.
 *
 * After download, if GCS only had the previous SSD’s filenames (leading YYYYMMDD ≠ folder day),
 * creates same-directory symlinks so `pickTodaysTimetable()` strict patterns match.
 *
 * Env:
 *   DARWIN_YMD           optional compact override YYYYMMDD (default = UK railway day now)
 *   DARWIN_TIMETABLE_DIR optional absolute or relative target directory
 *   DARWIN_GCS_PPT_PREFIX gs://… prefix (default in code)
 *   GSUTIL_PATH          optional full path to gsutil (cron often has a minimal PATH)
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  lstatSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUCKET_PREFIX = process.env.DARWIN_GCS_PPT_PREFIX
  || 'gs://rail-statistics.firebasestorage.app/DARWINTTFILES/PPTimetable';

/** Same constant as departures-daemon.mjs / railwayOperatingDayUk.ts */
const UK_RAILWAY_DAY_START_MINUTES = 2 * 60;

/** UK railway operating day as compact YYYYMMDD (Europe/London, day rolls at 02:00). */
function railwayDayYmdCompact(now = new Date()) {
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
  const railwayDayUtcMs = londonAsUtcMs - UK_RAILWAY_DAY_START_MINUTES * 60 * 1000;
  return new Date(railwayDayUtcMs).toISOString().slice(0, 10).replace(/-/g, '');
}

function shiftYmd(ymd, deltaDays) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
}

function findGsutil() {
  const explicit = (process.env.GSUTIL_PATH || '').trim();
  if (explicit && existsSync(explicit)) return explicit;
  for (const p of ['/usr/bin/gsutil', '/usr/local/bin/gsutil']) {
    if (existsSync(p)) return p;
  }
  return 'gsutil';
}

const GSUTIL = findGsutil();

function runGsutil(args) {
  return execFileSync(GSUTIL, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: process.env.HOME || homedir(),
      PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    },
  });
}

function listFilesByPattern(pattern) {
  try {
    const out = runGsutil(['ls', pattern]);
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    const msg = String(err?.message || '');
    if (msg.includes('One or more URLs matched no objects')) return [];
    throw err;
  }
}

function pickLatest(files, matcher) {
  const matches = [];
  for (const uri of files) {
    const name = basename(uri);
    const m = matcher.exec(name);
    if (!m) continue;
    matches.push({ uri, stamp: Number(m[1]) });
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.stamp - a.stamp);
  return matches[0].uri;
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function maybeDownload(uri, targetDir) {
  const name = basename(uri);
  const local = resolve(targetDir, name);
  if (existsSync(local)) {
    console.log(`[fetch] already exists, skipping: ${name}`);
    return { name, status: 'skipped' };
  }
  runGsutil(['cp', uri, targetDir]);
  console.log(`[fetch] downloaded: ${name}`);
  return { name, status: 'downloaded' };
}

/**
 * Daemon expects `tt/<railwayYmd>/` to contain `^${railwayYmd}\\d{6}_v\\d+\\.xml\\.gz$`.
 * When files are named with the previous calendar SSD inside that folder, add symlinks.
 */
function ensureDaemonAliasSymlinks(targetDir, railwayYmdCompact) {
  let files;
  try {
    files = readdirSync(targetDir);
  } catch {
    return;
  }
  const fullStampRe = /^(\d{14})_(v\d+\.xml\.gz|ref_v\d+\.xml\.gz)$/;
  for (const name of files) {
    if (!name.endsWith('.xml.gz')) continue;
    const abs = resolve(targetDir, name);
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    const m = fullStampRe.exec(name);
    if (!m) continue;
    const stamp14 = m[1];
    const tail = m[2];
    const fileYmd = stamp14.slice(0, 8);
    if (fileYmd === railwayYmdCompact) continue;
    const time6 = stamp14.slice(8);
    const aliasName = `${railwayYmdCompact}${time6}_${tail}`;
    const aliasAbs = resolve(targetDir, aliasName);
    if (existsSync(aliasAbs)) continue;
    try {
      symlinkSync(name, aliasAbs);
      console.log(`[fetch] symlink for daemon filename match: ${aliasName} -> ${name}`);
    } catch (e) {
      console.warn(`[fetch] symlink ${aliasName} failed: ${e.message}`);
    }
  }
}

function main() {
  const ymd = process.env.DARWIN_YMD || railwayDayYmdCompact();
  const targetDir = resolve(__dirname, process.env.DARWIN_TIMETABLE_DIR || `./tt/${ymd}`);
  ensureDir(targetDir);
  const candidateDates = [ymd, shiftYmd(ymd, -1)];
  let selectedDate = null;
  let v8Uri = null;
  let refV99Uri = null;

  for (const d of candidateDates) {
    console.log(`[fetch] scanning ${BUCKET_PREFIX} for date ${d}`);
    const files = listFilesByPattern(`${BUCKET_PREFIX}/${d}*`);
    v8Uri = pickLatest(files, /^(\d{14})_v8\.xml\.gz$/);
    refV99Uri = pickLatest(files, /^(\d{14})_ref_v99\.xml\.gz$/);
    if (v8Uri && refV99Uri) {
      selectedDate = d;
      break;
    }
  }

  // Last fallback: pick latest available from the whole prefix.
  if (!v8Uri || !refV99Uri) {
    console.log(`[fetch] date-scoped scan missed files, falling back to latest available under ${BUCKET_PREFIX}`);
    const allFiles = listFilesByPattern(`${BUCKET_PREFIX}/*`);
    if (!v8Uri) v8Uri = pickLatest(allFiles, /^(\d{14})_v8\.xml\.gz$/);
    if (!refV99Uri) refV99Uri = pickLatest(allFiles, /^(\d{14})_ref_v99\.xml\.gz$/);
    selectedDate = selectedDate || 'latest-available';
  }

  if (!v8Uri) throw new Error(`no v8 file found (checked ${candidateDates.join(', ')} and full prefix)`);
  if (!refV99Uri) throw new Error(`no ref_v99 file found (checked ${candidateDates.join(', ')} and full prefix)`);

  console.log(`[fetch] selected v8: ${basename(v8Uri)}`);
  console.log(`[fetch] selected ref_v99: ${basename(refV99Uri)}`);
  console.log(`[fetch] source date window: ${selectedDate}`);
  console.log(`[fetch] using gsutil: ${GSUTIL}`);

  const results = [maybeDownload(v8Uri, targetDir), maybeDownload(refV99Uri, targetDir)];
  const downloaded = results.filter((r) => r.status === 'downloaded').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  ensureDaemonAliasSymlinks(targetDir, ymd);
  console.log(`[fetch] complete: downloaded=${downloaded}, skipped=${skipped}, dir=${targetDir}`);
}

try {
  main();
} catch (err) {
  console.error(`[fetch] failed: ${err.message}`);
  process.exit(1);
}
