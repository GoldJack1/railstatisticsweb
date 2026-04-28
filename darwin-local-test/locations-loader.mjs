/*
 * Loads LocationRef (TIPLOC → CRS / name / toc) and TocRef (TOC code → name)
 * from a Darwin PPTimetable_*_ref_v{N}.xml.gz reference file.
 *
 * Notes:
 *  - Ref files have their own version scheme (v1/v2/v3/v4/v99), unrelated to
 *    timetable v5/v6/v7/v8. v4 is the current "production" version as of
 *    2026-04-28; structure has been stable across v2..v4.
 *  - Many LocationRef entries are junctions/sidings without a CRS or human
 *    name — locname falls back to the TIPLOC itself.
 */

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { pickTodaysRefFile } from './reasons-loader.mjs';

// Use [^>]*? so attribute values like url="http://..." (with slashes) still match.
const LOC_RE = /<LocationRef\s+([^>]*?)\/>/g;
const TOC_RE = /<TocRef\s+([^>]*?)\/>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

function parseAttrs(s) {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(s))) out[m[1]] = m[2];
  return out;
}

/** Parse a ref file at an absolute path. */
export function loadLocationsFromFile(filePath) {
  const t0 = Date.now();
  const xml = gunzipSync(readFileSync(filePath)).toString('utf8');
  const locations = new Map();
  const tocs = new Map();

  let m;
  LOC_RE.lastIndex = 0;
  while ((m = LOC_RE.exec(xml))) {
    const a = parseAttrs(m[1]);
    if (!a.tpl) continue;
    locations.set(a.tpl.toUpperCase(), {
      tpl: a.tpl.toUpperCase(),
      crs: a.crs || null,
      toc: a.toc || null,
      name: a.locname && a.locname !== a.tpl ? a.locname.replace(/&amp;/g, '&') : null,
    });
  }
  TOC_RE.lastIndex = 0;
  while ((m = TOC_RE.exec(xml))) {
    const a = parseAttrs(m[1]);
    if (!a.toc) continue;
    tocs.set(a.toc.toUpperCase(), {
      toc: a.toc.toUpperCase(),
      name: a.tocname || null,
      url:  a.url || null,
    });
  }
  console.log(`[ref] ${filePath.split('/').pop()}: locations=${locations.size} tocs=${tocs.size} (${Date.now() - t0}ms)`);
  return { locations, tocs };
}

/** Auto-pick today's ref file (or the latest any-day fallback). */
export function loadTodaysLocations() {
  const p = pickTodaysRefFile();
  if (!p) {
    console.warn('[ref] no reference file found — names and CRS codes will be absent.');
    return { locations: new Map(), tocs: new Map() };
  }
  return loadLocationsFromFile(p);
}

/** Friendly display helpers. */
export function makeResolvers({ locations, tocs }) {
  return {
    tiplocToName: (tpl) => {
      if (!tpl) return null;
      const e = locations.get(tpl.toUpperCase());
      return e?.name || tpl;
    },
    tiplocToCrs: (tpl) => {
      if (!tpl) return null;
      return locations.get(tpl.toUpperCase())?.crs || null;
    },
    tocToName: (code) => {
      if (!code) return null;
      const e = tocs.get(code.toUpperCase());
      return e?.name || code;
    },
  };
}
