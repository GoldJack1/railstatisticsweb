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

import {
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { finished } from 'node:stream/promises';
import { createGunzip, createGzip, gunzipSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
});

/**
 * Gzipped JSON sidecars beside each `.xml.gz` — skips XML parse on cache hit.
 * v2: two gzipped JSONL streams (no monolithic JSON.stringify — avoids V8 max string length).
 * v1: legacy single `.jidx.json.gz` blob (still read if present and fresh).
 */
const JIDX_VERSION_V1 = 1;
const JIDX_VERSION = 2;
const JIDX_SUFFIX_V1 = '.jidx.json.gz';
const JIDX_SUFFIX_RID = '.jidx.rid.jsonl.gz';
const JIDX_SUFFIX_TPL = '.jidx.tpl.jsonl.gz';

function jidxDisabled() {
  const v = String(process.env.TIMETABLE_JIDX_DISABLE || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function jidxStemForXmlGz(xmlGzPath) {
  if (!xmlGzPath || typeof xmlGzPath !== 'string') return null;
  if (!xmlGzPath.endsWith('.xml.gz')) return null;
  return xmlGzPath.slice(0, -'.xml.gz'.length);
}

function jidxV1PathForXmlGz(xmlGzPath) {
  const stem = jidxStemForXmlGz(xmlGzPath);
  return stem ? `${stem}${JIDX_SUFFIX_V1}` : null;
}

function jidxV2PathsForXmlGz(xmlGzPath) {
  const stem = jidxStemForXmlGz(xmlGzPath);
  if (!stem) return null;
  return { ridPath: `${stem}${JIDX_SUFFIX_RID}`, tplPath: `${stem}${JIDX_SUFFIX_TPL}` };
}

/** True when v2 pair or legacy v1 sidecar is present and not older than the source timetable file. */
export function isJidxFreshForXmlGz(xmlGzPath) {
  if (jidxDisabled()) return false;
  let stXml;
  try {
    stXml = statSync(xmlGzPath);
  } catch {
    return false;
  }
  const v2 = jidxV2PathsForXmlGz(xmlGzPath);
  if (v2 && existsSync(v2.ridPath) && existsSync(v2.tplPath)) {
    try {
      const stR = statSync(v2.ridPath);
      const stT = statSync(v2.tplPath);
      return stR.mtimeMs >= stXml.mtimeMs && stT.mtimeMs >= stXml.mtimeMs;
    } catch {
      return false;
    }
  }
  const v1 = jidxV1PathForXmlGz(xmlGzPath);
  if (!v1 || !existsSync(v1)) return false;
  try {
    return statSync(v1).mtimeMs >= stXml.mtimeMs;
  } catch {
    return false;
  }
}

/** Resolves when queued jidx v2 writes have finished (for scripts such as warm-jidx). */
let jidxWriteTail = Promise.resolve();
export function flushJidxWriteQueue() {
  return jidxWriteTail;
}

function enqueueJidxWrite(fn) {
  jidxWriteTail = jidxWriteTail.then(fn).catch((e) => {
    console.warn(`[tt] jidx write failed: ${e.message}`);
  });
}

/**
 * @returns {Promise<{ byRid: Map, byTiploc: Map } | null>}
 */
async function readJidxJsonlGzToMap(filePath, expectedPart) {
  const input = createReadStream(filePath).pipe(createGunzip());
  const rl = createInterface({ input, crlfDelay: Infinity });
  let lineNo = 0;
  /** @type {object | null} */
  let header = null;
  const map = new Map();
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      lineNo++;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        return null;
      }
      if (lineNo === 1) {
        header = row;
        if (header?.v !== JIDX_VERSION || header.part !== expectedPart) return null;
        continue;
      }
      if (!Array.isArray(row) || row.length !== 2) return null;
      map.set(row[0], row[1]);
    }
  } catch {
    return null;
  }
  return { header, map };
}

async function streamWriteJidxJsonlGz(outPath, header, asyncIterable) {
  const tmp = `${outPath}.tmp`;
  const level = Math.max(1, Math.min(9, Number(process.env.TIMETABLE_JIDX_GZIP_LEVEL || 6)));
  const gz = createGzip({ level });
  const out = createWriteStream(tmp);
  gz.pipe(out);
  const writeChunk = (chunk) =>
    new Promise((resolve, reject) => {
      gz.write(chunk, (err) => (err ? reject(err) : resolve()));
    });
  try {
    await writeChunk(JSON.stringify(header) + '\n');
    for await (const line of asyncIterable) {
      await writeChunk(line + '\n');
    }
    await new Promise((resolve, reject) => {
      gz.end((err) => (err ? reject(err) : resolve()));
    });
    await finished(out);
    renameSync(tmp, outPath);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

async function writeJidxV2Pair(xmlGzPath, stXml, byRid, byTiploc) {
  const paths = jidxV2PathsForXmlGz(xmlGzPath);
  if (!paths) return;
  const { ridPath, tplPath } = paths;
  const meta = {
    v: JIDX_VERSION,
    savedAt: new Date().toISOString(),
    sourceXmlMtimeMs: stXml.mtimeMs,
  };
  async function* ridLines() {
    for (const [rid, schedule] of byRid) yield JSON.stringify([rid, schedule]);
  }
  async function* tplLines() {
    for (const [tpl, arr] of byTiploc) yield JSON.stringify([tpl, arr]);
  }
  await streamWriteJidxJsonlGz(ridPath, { ...meta, part: 'rid' }, ridLines());
  await streamWriteJidxJsonlGz(tplPath, { ...meta, part: 'tpl' }, tplLines());
  try {
    const legacy = jidxV1PathForXmlGz(xmlGzPath);
    if (legacy && existsSync(legacy)) unlinkSync(legacy);
  } catch {
    /* ignore */
  }
  let sz = 0;
  try {
    sz = statSync(ridPath).size + statSync(tplPath).size;
  } catch {
    /* ignore */
  }
  console.log(`[tt] ${basename(xmlGzPath)}: wrote jidx v2 (${(sz / 1024 / 1024).toFixed(1)} MiB gzip total)`);
}

/**
 * @returns {{ byRid: Map, byTiploc: Map } | null}
 */
function tryReadJourneyIndexCacheV1(xmlGzPath) {
  const jidxPath = jidxV1PathForXmlGz(xmlGzPath);
  if (!jidxPath || !existsSync(jidxPath)) return null;
  let stXml;
  let stJ;
  try {
    stXml = statSync(xmlGzPath);
    stJ = statSync(jidxPath);
  } catch {
    return null;
  }
  if (stJ.mtimeMs < stXml.mtimeMs) return null;
  const t0 = Date.now();
  try {
    const raw = JSON.parse(gunzipSync(readFileSync(jidxPath)).toString('utf8'));
    if (raw.v !== JIDX_VERSION_V1 || !Array.isArray(raw.byRidEntries) || !Array.isArray(raw.byTiplocEntries)) {
      return null;
    }
    const byRid = new Map(raw.byRidEntries);
    const byTiploc = new Map(raw.byTiplocEntries);
    const elapsed = Date.now() - t0;
    console.log(
      `[tt] ${basename(xmlGzPath)}: loaded ${byRid.size} journeys, ${byTiploc.size} TIPLOCs from jidx v1 (${elapsed}ms)`,
    );
    return { byRid, byTiploc };
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ byRid: Map, byTiploc: Map } | null>}
 */
async function tryReadJourneyIndexCacheV2(xmlGzPath) {
  const paths = jidxV2PathsForXmlGz(xmlGzPath);
  if (!paths) return null;
  const { ridPath, tplPath } = paths;
  if (!existsSync(ridPath) || !existsSync(tplPath)) return null;
  let stXml;
  let stRid;
  let stTpl;
  try {
    stXml = statSync(xmlGzPath);
    stRid = statSync(ridPath);
    stTpl = statSync(tplPath);
  } catch {
    return null;
  }
  if (stRid.mtimeMs < stXml.mtimeMs || stTpl.mtimeMs < stXml.mtimeMs) return null;
  const t0 = Date.now();
  const [ridOut, tplOut] = await Promise.all([
    readJidxJsonlGzToMap(ridPath, 'rid'),
    readJidxJsonlGzToMap(tplPath, 'tpl'),
  ]);
  if (!ridOut?.map || !tplOut?.map || !ridOut.header || !tplOut.header) return null;
  if (ridOut.header.sourceXmlMtimeMs !== tplOut.header.sourceXmlMtimeMs) return null;
  const byRid = ridOut.map;
  const byTiploc = tplOut.map;
  const elapsed = Date.now() - t0;
  console.log(
    `[tt] ${basename(xmlGzPath)}: loaded ${byRid.size} journeys, ${byTiploc.size} TIPLOCs from jidx v2 (${elapsed}ms)`,
  );
  return { byRid, byTiploc };
}

/**
 * @returns {Promise<{ byRid: Map, byTiploc: Map } | null>}
 */
async function tryReadAnyJourneyIndexCache(xmlGzPath) {
  const v2 = await tryReadJourneyIndexCacheV2(xmlGzPath);
  if (v2) return v2;
  return tryReadJourneyIndexCacheV1(xmlGzPath);
}

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

/**
 * Convert a compact slot's earliest known time (HH:MM[:SS]) to seconds since
 * midnight, for chronological sorting. Slots without any time get +Infinity
 * so they sink to the end of their slice rather than ahead of timed entries.
 *
 * Picks the EARLIEST time of (arr, dep, pass) — for an intermediate stop the
 * arrival is what really anchors it on the line, not the departure.
 */
function slotTimeSeconds(s) {
  // Order matters: prefer working times when both are present (sub-minute
  // precision for passing points and tight runs); fall back to public.
  const candidates = [s.wta, s.pta, s.wtd, s.ptd, s.wtp];
  let best = Number.POSITIVE_INFINITY;
  for (const t of candidates) {
    if (!t) continue;
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t));
    if (!m) continue;
    const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0);
    if (secs < best) best = secs;
  }
  return best;
}

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

/**
 * Load the whole timetable file (no TIPLOC filter) and build two indexes:
 *   byRid:    rid -> normalised journey { rid, ssd, uid, trainId, toc, ...,
 *                                         slots: Array<{ tpl, _slot, ptd, pta,
 *                                         wtd, wta, wtp, plat, act }> }
 *   byTiploc: tpl -> Array<{ rid, stopIdx }>   (so we can quickly list the
 *                                              services calling at a station
 *                                              without re-scanning every journey)
 *
 * This is the engine for the "any station on request" daemon. Memory-wise we
 * keep one journey object per RID plus small pointer arrays per TIPLOC.
 *
 * @param {string} filePath absolute path to the .xml.gz timetable file
 */
function parseAllJourneysIndexedFromXmlSync(filePath) {
  const t0 = Date.now();
  const buf = readFileSync(filePath);
  const xml = gunzipSync(buf).toString('utf8');
  const chunks = xml.split('</Journey>');

  const byRid = new Map();
  const byTiploc = new Map();
  let parsed = 0;
  let totalSlots = 0;

  for (const c of chunks) {
    const open = c.lastIndexOf('<Journey ');
    if (open < 0) continue;
    const journeyXml = c.slice(open) + '</Journey>';
    let doc;
    try { doc = xmlParser.parse(journeyXml); } catch { continue; }
    const j = doc.Journey;
    if (!j || !j.rid) continue;
    parsed++;

    const slots = normaliseJourney(j);
    if (slots.length === 0) continue;

    // Identify origin & final destination from the raw slots, independent of
    // the array order our flattener produces.
    let origin = '';
    for (const s of slots) {
      if (ORIGIN_SLOTS.includes(s._slot)) { origin = locTpl(s); break; }
    }
    if (!origin) origin = locTpl(slots[0]);
    let destination = '';
    for (let i = slots.length - 1; i >= 0; i--) {
      if (DEST_SLOTS.includes(slots[i]._slot)) { destination = locTpl(slots[i]); break; }
    }
    if (!destination) destination = locTpl(slots[slots.length - 1]);

    // Store a compact per-location view — every attribute the daemon or the
    // board/service-detail code needs.
    const compactSlots = slots.map((s) => ({
      tpl:  locTpl(s),
      slot: s._slot,
      ptd:  s.ptd  || null,
      pta:  s.pta  || null,
      wtd:  s.wtd  || null,
      wta:  s.wta  || null,
      wtp:  s.wtp  || null,
      plat: s.plat ? String(s.plat).trim() : null,
      act:  s.act  ? String(s.act).trim()  : null,
    }));

    // fast-xml-parser groups same-named elements, so the natural array order
    // is OR, IP, IP..., PP, PP..., DT — passing points all fall to the end
    // of the route. Sort by the earliest known time at each location to
    // Restore route order, anchoring OR first and DT last so we don't get
    // tripped up by services whose times wrap across midnight or where a PP
    // happens to coincide with a stop.
    //
    // Midnight rollover: pure HH:MM:SS sorting puts post-midnight stops
    // (00:05, 00:07 …) BEFORE the evening intermediates (21:14, 22:30 …) for
    // a service that originates at, say, 21:02 and finishes at 00:30 the
    // next day. To fix this we anchor on the origin's time and treat any
    // slot whose raw seconds are >6h earlier than the anchor as belonging
    // to the next day (+86400s). 6h is a safe gap: no real journey segment
    // jumps that far backwards within the same operating day.
    const anchorSlot = compactSlots.find((s) => s.slot === 'OR' || s.slot === 'OPOR') || compactSlots[0];
    const anchorSec  = anchorSlot ? slotTimeSeconds(anchorSlot) : 0;
    const ROLLOVER   = 6 * 3600;
    const effSec = (s) => {
      const t = slotTimeSeconds(s);
      return (t < anchorSec - ROLLOVER) ? t + 86400 : t;
    };
    compactSlots.sort((a, b) => {
      if (a.slot === 'OR' || a.slot === 'OPOR') return -1;
      if (b.slot === 'OR' || b.slot === 'OPOR') return 1;
      if (a.slot === 'DT' || a.slot === 'OPDT') return 1;
      if (b.slot === 'DT' || b.slot === 'OPDT') return -1;
      return effSec(a) - effSec(b);
    });
    totalSlots += compactSlots.length;

    byRid.set(j.rid, {
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
      slots: compactSlots,
    });

    // Index every calling point (one entry per (tpl, stop-within-journey)).
    for (let i = 0; i < compactSlots.length; i++) {
      const tp = compactSlots[i].tpl;
      if (!tp) continue;
      let arr = byTiploc.get(tp);
      if (!arr) { arr = []; byTiploc.set(tp, arr); }
      arr.push({ rid: j.rid, stopIdx: i });
    }
  }

  const elapsed = Date.now() - t0;
  console.log(`[tt] ${filePath.split('/').pop()}: parsed ${parsed} journeys, ${totalSlots} slots, indexed ${byTiploc.size} distinct TIPLOCs (${elapsed}ms)`);

  return { byRid, byTiploc };
}

export async function loadAllJourneysIndexedByTiploc(filePath) {
  if (!jidxDisabled()) {
    const fromIdx = await tryReadAnyJourneyIndexCache(filePath);
    if (fromIdx) return fromIdx;
  }

  const result = parseAllJourneysIndexedFromXmlSync(filePath);

  if (!jidxDisabled()) {
    let stXml;
    try {
      stXml = statSync(filePath);
    } catch {
      stXml = null;
    }
    if (stXml) {
      enqueueJidxWrite(() => writeJidxV2Pair(filePath, stXml, result.byRid, result.byTiploc));
    }
  }

  return result;
}
