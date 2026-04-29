/**
 * One-off: capture the next 5 uR.OW messages and dump their full Msg structure
 * to see exactly what the JSON-feed serializer kept (vs. dropped).
 *
 * Run with the daemon STOPPED so we don't fight for partitions.
 */
import { Kafka, logLevel } from 'kafkajs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const kafka = new Kafka({
  clientId: 'rs-probe-ow', brokers: [process.env.DARWIN_BOOTSTRAP], ssl: true,
  sasl: { mechanism: 'plain', username: process.env.DARWIN_USERNAME, password: process.env.DARWIN_PASSWORD },
  logLevel: logLevel.ERROR,
});
const consumer = kafka.consumer({ groupId: process.env.DARWIN_GROUP_ID, sessionTimeout: 10000 });
await consumer.connect();
await consumer.subscribe({ topic: process.env.DARWIN_TOPIC || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON', fromBeginning: false });

let captured = 0;
const RUN_SEC = Number(process.env.RUN_SEC || 60);
const startedAt = Date.now();

await consumer.run({
  eachMessage: async ({ message }) => {
    if (Date.now() - startedAt > RUN_SEC * 1000) return;
    if (captured >= 5) return;
    let env;
    try {
      const v = JSON.parse(message.value.toString('utf8'));
      env = typeof v.bytes === 'string' ? JSON.parse(v.bytes) : v;
    } catch { return; }
    const ows = env?.uR?.OW;
    if (!ows) return;
    const list = Array.isArray(ows) ? ows : [ows];
    for (const ow of list) {
      captured++;
      console.log(`\n=== OW #${captured} id=${ow.id} sev=${ow.sev} cat=${ow.cat} ===`);
      console.log(JSON.stringify(ow, null, 2));
      if (captured >= 5) break;
    }
  },
});

setTimeout(async () => {
  console.log(`\n[done] captured ${captured} OW messages over ${RUN_SEC}s`);
  await consumer.disconnect();
  process.exit(0);
}, RUN_SEC * 1000 + 1000);
