/**
 * Build timetable jidx v2 sidecars (*.jidx.rid.jsonl.gz + *.jidx.tpl.jsonl.gz) for each tt/YYYYMMDD.
 * First load still parses XML; writes stream in the background — flush before exit.
 *
 * Usage: node warm-jidx.mjs [ttRoot]
 * Default ttRoot: $DARWIN_TIMETABLE_DIR or ./tt beside this script.
 */
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flushJidxWriteQueue, isJidxFreshForXmlGz, loadAllJourneysIndexedByTiploc } from './timetable-loader.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ttRoot = resolve(process.argv[2] || process.env.DARWIN_TIMETABLE_DIR || resolve(__dirname, 'tt'));

function pickHighestXmlGz(dir, ymd) {
  const nameRe = new RegExp(`^(?:PPTimetable_)?${ymd}\\d{6}_v(\\d+)\\.xml\\.gz$`);
  const matches = [];
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    return null;
  }
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

let processed = 0;
let skippedNoXml = 0;
let skippedFreshJidx = 0;

for (const ent of readdirSync(ttRoot, { withFileTypes: true })) {
  if (!ent.isDirectory() || !/^\d{8}$/.test(ent.name)) continue;
  const ymd = ent.name;
  const xmlPath = pickHighestXmlGz(resolve(ttRoot, ymd), ymd);
  if (!xmlPath) {
    skippedNoXml++;
    continue;
  }
  if (isJidxFreshForXmlGz(xmlPath)) {
    skippedFreshJidx++;
    continue;
  }
  await loadAllJourneysIndexedByTiploc(xmlPath);
  processed++;
}

await flushJidxWriteQueue();

console.log(
  `[warm-jidx] ttRoot=${ttRoot} processed=${processed} skipped(no_xml)=${skippedNoXml} skipped(already_fresh)=${skippedFreshJidx}`,
);
