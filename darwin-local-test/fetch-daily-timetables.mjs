#!/usr/bin/env node
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

function runGsutil(args) {
  return execFileSync('gsutil', args, { encoding: 'utf8' });
}

function listTodaysFiles(ymd) {
  const pattern = `${BUCKET_PREFIX}/${ymd}*`;
  const out = runGsutil(['ls', pattern]);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
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
  console.log(`[fetch] scanning ${BUCKET_PREFIX} for date ${ymd}`);

  const files = listTodaysFiles(ymd);
  const v8Uri = pickLatest(files, /^(\d{14})_v8\.xml\.gz$/);
  const refV99Uri = pickLatest(files, /^(\d{14})_ref_v99\.xml\.gz$/);

  if (!v8Uri) throw new Error(`no v8 file found for ${ymd}`);
  if (!refV99Uri) throw new Error(`no ref_v99 file found for ${ymd}`);

  console.log(`[fetch] selected v8: ${basename(v8Uri)}`);
  console.log(`[fetch] selected ref_v99: ${basename(refV99Uri)}`);

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
