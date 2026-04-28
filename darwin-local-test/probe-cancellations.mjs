#!/usr/bin/env node
/*
 * Verifies that our cancellation-reason decoding works end-to-end.
 *
 * Listens live for CANCEL_SEC seconds (default 90) across the WHOLE feed
 * (any TIPLOC) and reports every cancellation/reason it observes, decoded
 * against the local reference-data tables.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Kafka, logLevel } from 'kafkajs';
import { loadTodaysReasons } from './reasons-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const LIVE_SEC = Number(process.env.CANCEL_SEC || 90);
const { lateReasons, cancelReasons } = loadTodaysReasons();

function asArray(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
function unwrap(v) { return typeof v === 'object' ? (v['#text'] || v._ || v) : v; }

const kafka = new Kafka({
  clientId: 'rs-cancel-probe',
  brokers: [process.env.DARWIN_BOOTSTRAP],
  ssl: true,
  sasl: { mechanism: 'plain', username: process.env.DARWIN_USERNAME, password: process.env.DARWIN_PASSWORD },
  connectionTimeout: 15000,
  authenticationTimeout: 15000,
  logLevel: logLevel.WARN,
});
const consumer = kafka.consumer({ groupId: process.env.DARWIN_GROUP_ID });

await consumer.connect();
await consumer.subscribe({ topic: process.env.DARWIN_TOPIC, fromBeginning: false });
console.log(`[probe] listening ${LIVE_SEC}s for any cancellations across the whole feed ...`);

const byRid = new Map();  // rid -> { events: [{source, code?, reason, time}] }
let consumed = 0;

setTimeout(async () => {
  try { await consumer.disconnect(); } catch {}
  const entries = [...byRid.entries()];
  console.log(`\n[probe] done. consumed=${consumed} affected-rids=${entries.length}\n`);
  if (entries.length === 0) {
    console.log('No cancellations observed in the live window.');
    console.log('Try increasing CANCEL_SEC (it may need 2-5 minutes during quiet periods).');
    process.exit(0);
  }
  console.log('rid                | source          | code | reason');
  console.log('-------------------|-----------------|------|-----------------------------------------');
  for (const [rid, v] of entries) {
    for (const ev of v.events) {
      console.log(
        `${rid.padEnd(18)} | ${ev.source.padEnd(15)} | ${String(ev.code || '').padEnd(4)} | ${ev.reason}`
      );
    }
  }
  process.exit(0);
}, LIVE_SEC * 1000);

await consumer.run({
  eachMessage: async ({ message }) => {
    consumed++;
    let inner;
    try {
      const raw = JSON.parse(message.value.toString());
      inner = typeof raw.bytes === 'string' ? JSON.parse(raw.bytes) : raw;
    } catch { return; }
    const pport = inner.Pport || inner;
    for (const env of ['uR', 'sR']) {
      const e = pport[env]; if (!e) continue;

      // schedule cancellations (full, with reason)
      for (const sc of asArray(e.schedule)) {
        if (!sc?.rid) continue;
        if (sc.cancelReason) {
          const code = String(unwrap(sc.cancelReason));
          const reason = cancelReasons.get(code) || `(unknown code ${code})`;
          addEvent(sc.rid, { source: 'schedule-cancel', code, reason });
        }
        // Per-location partial cancellations
        for (const k of ['OR','IP','PP','DT','OPOR','OPIP','OPPP','OPDT']) {
          for (const loc of asArray(sc[k])) {
            if (loc.can === 'true' || loc.can === true) {
              addEvent(sc.rid, { source: 'schedule-loc-can', reason: `stop ${loc.tpl} cancelled` });
            }
          }
        }
      }

      // TS messages
      for (const ts of asArray(e.TS)) {
        if (ts.cancelReason) {
          const code = String(unwrap(ts.cancelReason));
          addEvent(ts.rid, { source: 'ts-cancel', code, reason: cancelReasons.get(code) || `(unknown code ${code})` });
        }
        if (ts.lateReason) {
          const code = String(unwrap(ts.lateReason));
          addEvent(ts.rid, { source: 'ts-late', code, reason: lateReasons.get(code) || `(unknown code ${code})` });
        }
        for (const loc of asArray(ts.Location)) {
          if (loc.can === 'true' || loc.can === true) {
            addEvent(ts.rid, { source: 'ts-loc-can', reason: `stop ${loc.tpl} cancelled` });
          }
          if (loc.cancelReason) {
            const code = String(unwrap(loc.cancelReason));
            addEvent(ts.rid, { source: 'ts-loc-cancel', code, reason: cancelReasons.get(code) || `(unknown code ${code})` });
          }
          if (loc.lateReason) {
            const code = String(unwrap(loc.lateReason));
            addEvent(ts.rid, { source: 'ts-loc-late', code, reason: lateReasons.get(code) || `(unknown code ${code})` });
          }
        }
      }

      // deactivated
      for (const d of asArray(e.deactivated)) {
        if (d?.rid) addEvent(d.rid, { source: 'deactivated', reason: '(schedule removed, no reason carried)' });
      }
    }
  },
}).catch(() => {});

function addEvent(rid, ev) {
  const cur = byRid.get(rid) || { events: [] };
  // de-dupe by source+code
  const key = `${ev.source}|${ev.code || ''}`;
  if (!cur.events.some((e) => `${e.source}|${e.code || ''}` === key)) {
    cur.events.push(ev);
  }
  byRid.set(rid, cur);
}
