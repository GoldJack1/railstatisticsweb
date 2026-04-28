import { Kafka, logLevel } from 'kafkajs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const k = new Kafka({
  clientId: 'rs-dumper',
  brokers: [process.env.DARWIN_BOOTSTRAP],
  ssl: true,
  sasl: { mechanism: 'plain', username: process.env.DARWIN_USERNAME, password: process.env.DARWIN_PASSWORD },
  logLevel: logLevel.WARN,
});
const c = k.consumer({ groupId: process.env.DARWIN_GROUP_ID });
await c.connect();
await c.subscribe({ topic: process.env.DARWIN_TOPIC, fromBeginning: true });

const dumps = [];
const N = Number(process.env.DUMP_N || 6);

setTimeout(async () => {
  writeFileSync(resolve(__dirname, 'raw-samples.json'), JSON.stringify(dumps, null, 2));
  console.log(`wrote ${dumps.length} samples to raw-samples.json`);
  for (const d of dumps) {
    console.log('--- offset', d.offset, '---');
    console.log('top-level keys:', Object.keys(d.parsed || {}));
    console.log('preview:', JSON.stringify(d.parsed).slice(0, 280));
  }
  await c.disconnect();
  process.exit(0);
}, 12000);

await c.run({
  eachMessage: async ({ message }) => {
    if (dumps.length >= N) return;
    const text = message.value.toString('utf8');
    let parsed = null; try { parsed = JSON.parse(text); } catch {}
    dumps.push({ offset: message.offset, parsed, raw: text.slice(0, 500) });
  },
});
