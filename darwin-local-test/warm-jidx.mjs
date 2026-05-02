/**
 * Build timetable *.jidx.json.gz sidecars for each tt/YYYYMMDD (highest v*.xml.gz).
 * First load still parses XML; subsequent daemon startups skip XML via jidx.
 *
 * Usage: node warm-jidx.mjs [ttRoot]
 * Default ttRoot: $DARWIN_TIMETABLE_DIR or ./tt beside this script.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllJourneysIndexedByTiploc } from './timetable-loader.mjs';

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
  const jidxPath = `${xmlPath.slice(0, -'.xml.gz'.length)}.jidx.json.gz`;
  try {
    const stXml = statSync(xmlPath);
    if (existsSync(jidxPath)) {
      const stJ = statSync(jidxPath);
      if (stJ.mtimeMs >= stXml.mtimeMs) {
        skippedFreshJidx++;
        continue;
      }
    }
  } catch {
    continue;
  }
  loadAllJourneysIndexedByTiploc(xmlPath);
  processed++;
}

console.log(
  `[warm-jidx] ttRoot=${ttRoot} processed=${processed} skipped(no_xml)=${skippedNoXml} skipped(already_fresh)=${skippedFreshJidx}`,
);
