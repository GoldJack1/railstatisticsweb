#!/usr/bin/env node
/**
 * One-off PTAC Kafka replay from 00:01 London on today's railway SSD (timetable date).
 *
 * Uses a fresh consumer group so it does not disturb the daemon's committed offsets.
 *
 * Env (inherits daemon .env): PTAC_BOOTSTRAP, PTAC_USERNAME, PTAC_PASSWORD, PTAC_TOPIC,
 *   PTAC_FETCH_GROUP_ID — optional; default rs-ptac-fetch-<timestamp>
 *
 * Optional:
 *   PTAC_FETCH_OUT — NDJSON output path (default: state/ptac-fetch/<ssd>.ndjsonl)
 *   PTAC_FETCH_MAX_MSG — stop after N messages (default 500000)
 *   PTAC_FETCH_QUIET_MS — exit after this many ms with no messages (default 12000)
 */

import { mkdirSync, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const UK_RAILWAY_DAY_START_MINUTES = 2 * 60;

function railwayDayYmd(now = new Date()) {
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
  return new Date(railwayDayUtcMs).toISOString().slice(0, 10);
}

function londonParts(ms) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const pick = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { y: pick('year'), mo: pick('month'), d: pick('day'), h: pick('hour'), mi: pick('minute'), s: pick('second') };
}

/** First instant (UTC ms) where London is calendar date `ssd` (YYYY-MM-DD) and time is ≥ 00:01:00. */
function ssdStart0001UtcMs(ssd) {
  const [Y, M, D] = ssd.split('-').map(Number);
  let lo = Date.UTC(Y, M - 1, D - 1, 12, 0, 0);
  let hi = Date.UTC(Y, M - 1, D + 1, 12, 0, 0);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const p = londonParts(mid);
    const dayMs = Date.UTC(p.y, p.mo - 1, p.d);
    const targetMs = Date.UTC(Y, M - 1, D);
    let ok = false;
    if (dayMs > targetMs) ok = true;
    else if (dayMs < targetMs) ok = false;
    else ok = p.h > 0 || (p.h === 0 && p.mi >= 1);
    if (ok) hi = mid;
    else lo = mid;
  }
  return hi;
}

const bootstrap = process.env.PTAC_BOOTSTRAP || process.env.DARWIN_BOOTSTRAP;
const username = process.env.PTAC_USERNAME;
const password = process.env.PTAC_PASSWORD;
const topic = process.env.PTAC_TOPIC || 'prod-1033-Passenger-Train-Allocation-and-Consist-1_0';
const groupId = process.env.PTAC_FETCH_GROUP_ID || `rs-ptac-fetch-${Date.now()}`;

const MAX_MSG = Number(process.env.PTAC_FETCH_MAX_MSG || 500_000);
const QUIET_MS = Number(process.env.PTAC_FETCH_QUIET_MS || 12_000);

if (!bootstrap || !username || !password) {
  console.error('[fetch-ptac-today] missing PTAC_BOOTSTRAP / PTAC_USERNAME / PTAC_PASSWORD (or DARWIN_BOOTSTRAP for bootstrap only)');
  process.exit(1);
}

const ssd = railwayDayYmd(new Date());
const sinceMs = ssdStart0001UtcMs(ssd);

console.log(`[fetch-ptac-today] railway SSD=${ssd}  replay from London ≥ 00:01 on that date`);
console.log(`[fetch-ptac-today] since UTC ${new Date(sinceMs).toISOString()}  consumerGroup=${groupId}`);

const outPath =
  process.env.PTAC_FETCH_OUT ||
  resolve(__dirname, 'state/ptac-fetch', `${ssd.replace(/-/g, '')}.ndjsonl`);
mkdirSync(dirname(outPath), { recursive: true });
const outStream = createWriteStream(outPath, { flags: 'a' });

const kafka = new Kafka({
  clientId: 'rs-fetch-ptac-today',
  brokers: [bootstrap],
  ssl: true,
  sasl: { mechanism: 'plain', username, password },
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId });

await consumer.connect();
await consumer.subscribe({ topic, fromBeginning: false });

const admin = kafka.admin();
await admin.connect();
let replayOffsets;
try {
  replayOffsets = await admin.fetchTopicOffsetsByTimestamp(topic, sinceMs);
  console.log(`[fetch-ptac-today] topic offsets at sinceMs → ${replayOffsets.length} partition(s)`);
} catch (e) {
  console.error('[fetch-ptac-today] fetchTopicOffsetsByTimestamp failed:', e.message);
  process.exit(1);
} finally {
  await admin.disconnect();
}

let pendingReplaySeek = replayOffsets;
consumer.on(consumer.events.GROUP_JOIN, () => {
  if (!pendingReplaySeek?.length) return;
  const toSeek = pendingReplaySeek;
  pendingReplaySeek = null;
  setImmediate(() => {
    for (const o of toSeek) {
      try {
        consumer.seek({ topic, partition: o.partition, offset: o.offset });
      } catch (e) {
        console.warn(`[fetch-ptac-today] seek p${o.partition} failed: ${e.message}`);
      }
    }
    console.log('[fetch-ptac-today] startup replay seek applied.');
  });
});

let n = 0;
let lastMsg = Date.now();
let finished = false;

const quietTimer = setInterval(() => {
  if (finished) return;
  if (Date.now() - lastMsg >= QUIET_MS && n > 0) {
    console.log(`[fetch-ptac-today] quiet ${QUIET_MS}ms after last message — stopping (${n} messages).`);
    shutdown(0);
  }
}, 2000);

function shutdown(code = 0) {
  if (finished) return;
  finished = true;
  clearInterval(quietTimer);
  outStream.end();
  consumer.disconnect().finally(() => process.exit(code));
}

consumer
  .run({
    eachMessage: async ({ message }) => {
      lastMsg = Date.now();
      n++;
      const line =
        JSON.stringify({
          ts: new Date().toISOString(),
          partition: message.partition,
          offset: message.offset,
          payload: message.value?.toString('utf8') ?? '',
        }) + '\n';
      outStream.write(line);
      if (n >= MAX_MSG) {
        console.log(`[fetch-ptac-today] reached PTAC_FETCH_MAX_MSG=${MAX_MSG} — stopping.`);
        shutdown(0);
      }
    },
  })
  .catch((e) => {
    console.error('[fetch-ptac-today]', e);
    shutdown(1);
  });

console.log('[fetch-ptac-today] consuming… (Ctrl+C to stop) output:', outPath);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
