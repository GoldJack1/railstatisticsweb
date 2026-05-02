#!/usr/bin/env node
/**
 * Downloads today's Darwin PPTimetable files into ./tt/YYYYMMDD/
 * When scheduled from cron, run as the same UNIX user as darwin-daemon (railstats)
 * so the daemon can read the files; root cron causes permission failures at rollover.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUCKET_PREFIX = process.env.DARWIN_GCS_PPT_PREFIX
  || 'gs://rail-statistics.firebasestorage.app/DARWINTTFILES/PPTimetable';

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function shiftYmd(ymd, deltaDays) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
}

function runGsutil(args) {
  return execFileSync('gsutil', args, { encoding: 'utf8' });
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

function main() {
  const ymd = process.env.DARWIN_YMD || todayYmd();
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

  const results = [maybeDownload(v8Uri, targetDir), maybeDownload(refV99Uri, targetDir)];
  const downloaded = results.filter((r) => r.status === 'downloaded').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  console.log(`[fetch] complete: downloaded=${downloaded}, skipped=${skipped}, dir=${targetDir}`);
}

try {
  main();
} catch (err) {
  console.error(`[fetch] failed: ${err.message}`);
  process.exit(1);
}
