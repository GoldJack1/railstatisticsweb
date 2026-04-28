import { Kafka, logLevel } from 'kafkajs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const kafka = new Kafka({
  clientId: 'rs-probe',
  brokers: [process.env.DARWIN_BOOTSTRAP],
  ssl: true,
  sasl: { mechanism: 'plain', username: process.env.DARWIN_USERNAME, password: process.env.DARWIN_PASSWORD },
  logLevel: logLevel.WARN,
});

const admin = kafka.admin();
await admin.connect();
const topics = [
  'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON',
  'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-XML',
  'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-AVRO',
];
for (const t of topics) {
  try {
    const md = await admin.fetchTopicMetadata({ topics: [t] });
    for (const tm of md.topics) {
      console.log(`topic ${tm.name}: partitions=${tm.partitions.length}`);
      for (const p of tm.partitions) {
        console.log(`  p${p.partitionId}: leader=${p.leader} replicas=${p.replicas.join(',')} isr=${p.isr.join(',')}`);
      }
    }
  } catch (e) {
    console.log(`topic ${t}: ERROR ${e.type || ''} ${e.message}`);
  }
}
await admin.disconnect();
