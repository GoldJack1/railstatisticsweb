import { Kafka, logLevel } from 'kafkajs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const k = new Kafka({
  clientId: 'rs-sampler',
  brokers: [process.env.DARWIN_BOOTSTRAP],
  ssl: true,
  sasl: { mechanism: 'plain', username: process.env.DARWIN_USERNAME, password: process.env.DARWIN_PASSWORD },
  logLevel: logLevel.WARN,
});
const c = k.consumer({ groupId: process.env.DARWIN_GROUP_ID });
await c.connect();
await c.subscribe({ topic: process.env.DARWIN_TOPIC, fromBeginning: true });

const samples = {};      // typename -> first sample
const typeCounts = {};   // typename -> count
let consumed = 0;
const stopAt = Date.now() + Number(process.env.SAMPLE_SEC || 30) * 1000;

setTimeout(async () => {
  console.log(`consumed ${consumed} messages`);
  console.log('type counts:', typeCounts);
  const out = resolve(__dirname, 'type-samples.json');
  writeFileSync(out, JSON.stringify(samples, null, 2));
  console.log(`wrote samples to ${out}`);
  await c.disconnect();
  process.exit(0);
}, Number(process.env.SAMPLE_SEC || 30) * 1000);

await c.run({
  eachMessage: async ({ message }) => {
    consumed++;
    if (Date.now() > stopAt) return;
    let v;
    try { v = JSON.parse(message.value.toString('utf8')); } catch { return; }
    const pp = v.Pport || v;
    for (const env of ['uR', 'sR']) {
      const e = pp[env];
      if (!e) continue;
      for (const key of Object.keys(e)) {
        if (['updateOrigin', 'requestSource', 'requestID'].includes(key)) continue;
        typeCounts[key] = (typeCounts[key] || 0) + 1;
        if (!samples[key]) samples[key] = e[key];
      }
    }
  },
});
