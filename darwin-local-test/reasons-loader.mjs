/*
 * Loads LateRunningReasons & CancellationReasons from a Darwin
 * PPTimetable_*_ref_v{N}.xml.gz reference file.
 *
 * IMPORTANT: the two tables share numeric codes (e.g. code 911 exists in both,
 * with different texts), so they must be kept in SEPARATE maps. Resolve using
 * the right map depending on context:
 *   - lateReason codes    -> resolveLate(code)
 *   - cancelReason codes  -> resolveCancel(code)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REASON_LINE_RE = /<Reason\s+code="(\d+)"\s+reasontext="([^"]*)"\s*\/>/g;

function extractBlock(xml, tagName) {
  const m = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`).exec(xml);
  return m ? m[1] : '';
}

function parseReasonBlock(blockXml) {
  const out = new Map();
  let m;
  REASON_LINE_RE.lastIndex = 0;
  while ((m = REASON_LINE_RE.exec(blockXml))) {
    out.set(m[1], m[2]);
  }
  return out;
}

/**
 * @param {string} filePath absolute path to a ref_v*.xml.gz file
 */
export function loadReasonsFromFile(filePath) {
  const t0 = Date.now();
  const xml = gunzipSync(readFileSync(filePath)).toString('utf8');
  const lateReasons   = parseReasonBlock(extractBlock(xml, 'LateRunningReasons'));
  const cancelReasons = parseReasonBlock(extractBlock(xml, 'CancellationReasons'));
  console.log(`[ref] ${filePath.split('/').pop()}: late=${lateReasons.size} cancel=${cancelReasons.size} (${Date.now() - t0}ms)`);
  return { lateReasons, cancelReasons };
}

/**
 * Find today's highest-version reference file.
 */
export function pickTodaysRefFile() {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const dirs = [
    resolve(__dirname, `./tt/${ymd}`),
    resolve(__dirname, '../docs/timetablefiles'),
    resolve(__dirname, '../docs/V8s'),
  ];
  const nameRe = new RegExp(`^(?:PPTimetable_)?${ymd}\\d{6}_ref_v(\\d+)\\.xml\\.gz$`);
  const all = [];
  for (const dir of dirs) {
    let files = []; try { files = readdirSync(dir); } catch { continue; }
    for (const f of files) {
      const m = f.match(nameRe);
      if (!m) continue;
      const ver = Number(m[1] || 0);
      all.push({ path: resolve(dir, f), ver });
    }
  }
  if (all.length === 0) {
    // Fall back to ANY ref file in either folder — reasons codes rarely change.
    for (const dir of dirs) {
      let files = []; try { files = readdirSync(dir); } catch { continue; }
      for (const f of files) {
        if (!f.includes('_ref_') || !f.endsWith('.xml.gz')) continue;
        const ver = Number(f.match(/_v(\d+)\.xml\.gz$/)?.[1] || 0);
        all.push({ path: resolve(dir, f), ver });
      }
    }
  }
  if (all.length === 0) return null;
  all.sort((a, b) => b.ver - a.ver);
  return all[0].path;
}

/**
 * Convenience: load today's file automatically, returning null maps if
 * no ref file is present (so the caller can proceed without reasons).
 */
export function loadTodaysReasons() {
  const p = pickTodaysRefFile();
  if (!p) {
    console.warn('[ref] no reference file found — cancellation reasons will show as codes only.');
    return { lateReasons: new Map(), cancelReasons: new Map() };
  }
  return loadReasonsFromFile(p);
}
