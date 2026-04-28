/*
 * Loader for Darwin PPTimetable_<id>_v{5|6|7|8}.xml.gz files.
 *
 * Output: Map<rid, schedule> where schedule has the canonical fields we need
 * for enrichment (toc, trainId, origin, destination, calling pattern, etc.)
 * regardless of which schema version the file uses.
 *
 * Approach:
 *   1. gunzip the whole file into a string (typically 5-15 MB compressed,
 *      ~80-150 MB uncompressed — fits in memory).
 *   2. Regex-split on </Journey> to get one chunk per journey.
 *   3. Cheap pre-filter: keep only chunks whose text includes our target
 *      tiploc (`tpl="LEEDS"` or `ftl="LEEDS   "` padded to 8 chars).
 *   4. DOM-parse just the matching chunks with fast-xml-parser — typically
 *      a few hundred journeys for Leeds across a 24h window.
 *   5. Normalise schema differences and return.
 */

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
});

const LOC_KEYS_BY_SLOT = ['OR', 'IP', 'PP', 'DT', 'OPOR', 'OPIP', 'OPPP', 'OPDT'];
const ORIGIN_SLOTS = ['OR', 'OPOR'];
const DEST_SLOTS   = ['DT', 'OPDT'];

function locTpl(loc) {
  // v8 uses tpl="LEEDS"; v5 uses ftl="LEEDS   " (8-char padded).
  const raw = loc?.tpl ?? loc?.ftl ?? '';
  return String(raw).trim().toUpperCase();
}
function locTime(loc) {
  // departure preferred, otherwise arrival, then pass.
  return loc?.ptd || loc?.wtd || loc?.pta || loc?.wta || loc?.wtp || '';
}
function asArray(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }

function normaliseJourney(j) {
  const slots = [];
  for (const k of LOC_KEYS_BY_SLOT) {
    if (!(k in j)) continue;
    for (const loc of asArray(j[k])) {
      slots.push({ ...loc, _slot: k });
    }
  }
  return slots;
}

function findFirstTplFromSlots(slots, slotNames) {
  for (const s of slots) {
    if (slotNames.includes(s._slot)) return locTpl(s);
  }
  return '';
}

/**
 * Load a Darwin timetable .xml.gz file and index journeys calling at the
 * given tiploc.
 *
 * @param {string} filePath - absolute path to the .xml.gz timetable file
 * @param {string} tiploc   - canonical TIPLOC, e.g. "LEEDS"
 * @returns {Map<string, object>} rid -> schedule
 */
export function loadTimetableForTiploc(filePath, tiploc) {
  const t0 = Date.now();
  const buf = readFileSync(filePath);
  const xml = gunzipSync(buf).toString('utf8');
  const tipUpper = tiploc.toUpperCase();
  // v5 ftl is 8-char padded, v8 tpl is compact. Build cheap match patterns.
  const ftlPadded = tipUpper.padEnd(8, ' ');
  const needles = [`tpl="${tipUpper}"`, `ftl="${ftlPadded}"`];

  // Regex split into journeys — much cheaper than full DOM parse.
  // The header before the first <Journey> is harmless because we filter on
  // a Journey-only marker (tpl=/ftl=).
  const chunks = xml.split('</Journey>');
  const result = new Map();
  let scanned = 0;
  let parsed = 0;

  for (const c of chunks) {
    scanned++;
    if (!needles.some((n) => c.includes(n))) continue;
    const open = c.lastIndexOf('<Journey ');
    if (open < 0) continue;
    const journeyXml = c.slice(open) + '</Journey>';
    let doc;
    try { doc = xmlParser.parse(journeyXml); } catch { continue; }
    const j = doc.Journey;
    if (!j || !j.rid) continue;
    parsed++;

    const slots = normaliseJourney(j);
    const idx = slots.findIndex((s) => locTpl(s) === tipUpper);
    if (idx < 0) continue;
    const here = slots[idx];

    const origin = findFirstTplFromSlots(slots, ORIGIN_SLOTS) || locTpl(slots[0]);
    let destination = '';
    for (let i = slots.length - 1; i >= 0; i--) {
      if (DEST_SLOTS.includes(slots[i]._slot)) { destination = locTpl(slots[i]); break; }
    }
    if (!destination) destination = locTpl(slots[slots.length - 1]);

    const callingAfter = slots.slice(idx + 1)
      .filter((s) => s._slot === 'IP' || s._slot === 'OPIP' || s._slot === 'DT' || s._slot === 'OPDT')
      .map((s) => locTpl(s));

    result.set(j.rid, {
      rid: j.rid,
      ssd: j.ssd,
      uid: j.uid,
      trainId: j.trainId,
      toc: j.toc,
      trainCat: j.trainCat,
      status: j.status,
      isPassenger: j.isPassengerSvc !== 'false',
      origin,
      destination,
      callingAfter,
      plat: String(here.plat || '').trim(),
      time: locTime(here),
      activity: String(here.act || '').trim(),
      isPassing: here._slot === 'PP' || here._slot === 'OPPP',
    });
  }

  const elapsed = Date.now() - t0;
  console.log(`[tt] ${filePath.split('/').pop()}: scanned ${scanned} chunks, parsed ${parsed} journeys, indexed ${result.size} for ${tipUpper} (${elapsed}ms)`);
  return result;
}
