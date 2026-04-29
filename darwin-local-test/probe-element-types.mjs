/**
 * One-off survey: connect to the Darwin push-port topic with a NEW consumer
 * group (so we don't fight with the daemon), consume for ~30s, and tally
 * which element types / sub-fields are present in update messages.
 *
 * Run: node darwin-local-test/probe-element-types.mjs
 */
import { Kafka, logLevel } from 'kafkajs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const RUN_SECONDS = Number(process.env.RUN_SEC || 30);

const kafka = new Kafka({
  clientId: 'rs-probe-elements',
  brokers: [process.env.DARWIN_BOOTSTRAP],
  ssl: true,
  sasl: { mechanism: 'plain', username: process.env.DARWIN_USERNAME, password: process.env.DARWIN_PASSWORD },
  logLevel: logLevel.ERROR,
});

// Use the same group ID as the daemon. The Confluent ACL only authorises this
// one group ID for the credentials, so we can't spin up our own. Run this with
// the daemon STOPPED so we don't fight for partitions, then restart the daemon
// — its replay window covers any messages we consumed during the survey.
const consumer = kafka.consumer({ groupId: process.env.DARWIN_GROUP_ID, sessionTimeout: 10000 });
await consumer.connect();
await consumer.subscribe({ topic: process.env.DARWIN_TOPIC || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON', fromBeginning: false });

function decodeKafkaJson(rawBuf) {
  const v = JSON.parse(rawBuf.toString('utf8'));
  return typeof v.bytes === 'string' ? JSON.parse(v.bytes) : v;
}

const counts = new Map();
const subKeys = new Map();      // 'TS' -> Set('rid','late','cancelReason','...')
const exemplars = new Map();    // first time we see each top-level element type, save a tiny sample
let total = 0;

function tally(name, obj) {
  counts.set(name, (counts.get(name) || 0) + 1);
  if (!subKeys.has(name)) subKeys.set(name, new Set());
  const set = subKeys.get(name);
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) set.add(k);
  }
  if (!exemplars.has(name)) exemplars.set(name, JSON.stringify(obj).slice(0, 600));
}

const startedAt = Date.now();
await consumer.run({
  eachMessage: async ({ message }) => {
    if (Date.now() - startedAt > RUN_SECONDS * 1000) return;
    let env;
    try { env = decodeKafkaJson(message.value); } catch { return; }
    total++;
    if (env.uR) {
      // UpdateResponse — the wrapper that holds per-type child arrays.
      for (const key of Object.keys(env.uR)) {
        const v = env.uR[key];
        if (Array.isArray(v)) v.forEach((it) => tally(`uR.${key}`, it));
        else if (v && typeof v === 'object') tally(`uR.${key}`, v);
        else tally(`uR.${key}`, { _scalar: v });
      }
    } else {
      // Top-level element. Skip the small wrapper keys.
      for (const key of Object.keys(env)) {
        if (['xmlns','version','ts','origin','source','revision'].includes(key)) continue;
        const v = env[key];
        if (Array.isArray(v)) v.forEach((it) => tally(key, it));
        else if (v && typeof v === 'object') tally(key, v);
      }
    }
  },
});

setTimeout(async () => {
  console.log(`\n=== survey done: ${total} messages over ${RUN_SECONDS}s ===\n`);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, n] of sorted) {
    const keys = [...(subKeys.get(k) || [])].sort();
    console.log(`${k.padEnd(28)} ${String(n).padStart(7)}  fields: ${keys.join(', ')}`);
  }
  console.log('\n--- exemplars ---');
  for (const [k, ex] of exemplars) {
    console.log(`\n[${k}]\n${ex}`);
  }
  await consumer.disconnect();
  process.exit(0);
}, RUN_SECONDS * 1000 + 1500);
