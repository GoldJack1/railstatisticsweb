/**
 * One-off probe for the Network Rail S506 Passenger Train Allocation and
 * Consist feed. Captures a handful of messages, decodes the XML, and dumps
 * both the raw structure and a normalised summary so we can confirm the
 * data shape before committing to daemon code.
 *
 * Run:  node darwin-local-test/probe-ptac.mjs
 *
 * This uses the dedicated PTAC consumer group (not Darwin's), so it does NOT
 * conflict with the running darwin-departures daemon. Default RUN_SEC=20.
 */
import { Kafka, logLevel } from 'kafkajs';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const RUN_SEC      = Number(process.env.RUN_SEC || 20);
const MAX_CAPTURE  = Number(process.env.MAX_CAPTURE || 5);

if (!process.env.PTAC_BOOTSTRAP || !process.env.PTAC_USERNAME || !process.env.PTAC_GROUP_ID) {
  console.error('PTAC_* env vars are missing from .env');
  process.exit(1);
}

const kafka = new Kafka({
  clientId: 'rs-probe-ptac',
  brokers:  [process.env.PTAC_BOOTSTRAP],
  ssl:      true,
  sasl:     { mechanism: 'plain', username: process.env.PTAC_USERNAME, password: process.env.PTAC_PASSWORD },
  logLevel: logLevel.ERROR,
});
const consumer = kafka.consumer({ groupId: process.env.PTAC_GROUP_ID, sessionTimeout: 10000 });
console.log(`[probe] connecting to ${process.env.PTAC_BOOTSTRAP} as ${process.env.PTAC_USERNAME}`);
console.log(`[probe] topic=${process.env.PTAC_TOPIC} group=${process.env.PTAC_GROUP_ID}`);
await consumer.connect();
console.log('[probe] connected; subscribing...');
// fromBeginning is moot once the group has committed offsets — it only
// applies on first ever consumption. We instead seek N minutes back via
// fetchTopicOffsetsByTimestamp before run() so each probe pulls fresh data
// regardless of where the committed offset sits.
const REPLAY_MIN = Number(process.env.REPLAY_MIN || 10);
await consumer.subscribe({ topic: process.env.PTAC_TOPIC, fromBeginning: false });
console.log(`[probe] subscribed; will seek back ${REPLAY_MIN} min and listen for ${RUN_SEC}s.`);

// Resolve offsets corresponding to "now − REPLAY_MIN" so we re-read recent
// messages even after our group has caught up.
const admin = kafka.admin();
await admin.connect();
let replayOffsets = null;
try {
  replayOffsets = await admin.fetchTopicOffsetsByTimestamp(
    process.env.PTAC_TOPIC, Date.now() - REPLAY_MIN * 60_000
  );
} catch (e) { console.warn('[probe] offset lookup failed:', e.message); }
finally { await admin.disconnect(); }

// Same parser config we'll likely use in production: keep attributes,
// preserve element ordering, treat single-child arrays as such where they
// matter, leave string values as strings (don't auto-cast numbers).
const parser = new XMLParser({
  ignoreAttributes:    false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue:       false,
  trimValues:          true,
  // Force these to always come back as arrays so downstream code doesn't
  // have to branch on "single vs many".
  isArray: (name) => ['Allocation', 'Vehicle', 'Defect', 'ResourceGroup'].includes(name),
});

let captured = 0;
const startedAt = Date.now();

await consumer.run({
  eachMessage: async ({ message }) => {
    if (Date.now() - startedAt > RUN_SEC * 1000) return;
    if (captured >= MAX_CAPTURE) return;

    // The Confluent topic delivers raw XML as the message value (no JSON
    // envelope like Darwin's). Decode straight to UTF-8.
    const xml = message.value.toString('utf8');
    captured++;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`MESSAGE #${captured}  (offset ${message.offset}, key=${message.key?.toString() || 'null'})`);
    console.log('='.repeat(80));

    // The body sometimes has the LINX MQ control prefixes (<usr>, <mcd>,
    // <mqps>) before the XML root. Strip everything up to "<?xml" or the
    // first "<PassengerTrainConsistMessage" so the parser is happy.
    const xmlStart = xml.indexOf('<?xml');
    const stripped = xmlStart >= 0 ? xml.slice(xmlStart) : xml;
    console.log(`[raw bytes: ${xml.length}, parsed from offset ${xmlStart}]`);

    let doc;
    try { doc = parser.parse(stripped); }
    catch (e) {
      console.error('[parse error]', e.message);
      console.log(xml.slice(0, 500));
      return;
    }
    const m = doc.PassengerTrainConsistMessage;
    if (!m) {
      console.log('[no PassengerTrainConsistMessage root — top-level keys:', Object.keys(doc), ']');
      console.log(xml.slice(0, 500));
      return;
    }

    // ---- Normalised summary so we can see the shape at a glance ---------
    // Helpers to deal with fast-xml-parser's mixed-content shape:
    //   <Element attr="x">text</Element>  →  { "@_attr": "x", "#text": "text" }
    const txt   = (n) => (n == null ? null : typeof n === 'object' ? (n['#text'] ?? null) : String(n));
    const tiArr = m.TrainOperationalIdentification?.TransportOperationalIdentifiers;
    // The feed publishes one array entry per "lens" (operating TOC and LINX
    // system 0070). Both have the same Core/StartDate; pick the operating
    // TOC entry by preferring the one whose Company isn't "0070".
    const tiList = Array.isArray(tiArr) ? tiArr : (tiArr ? [tiArr] : []);
    const ti     = tiList.find((t) => String(t.Company) !== '0070') || tiList[0] || {};
    const otn    = m.OperationalTrainNumberIdentifier || {};
    const allocs = m.Allocation || [];

    console.log(`status:   ${m.MessageStatus} (1=Notification)`);
    console.log(`sender:   ${txt(m.MessageHeader?.Sender)} → ${txt(m.MessageHeader?.Recipient)}`);
    console.log(`msgId:    ${m.MessageHeader?.MessageReference?.MessageIdentifier}`);
    console.log(`msgTime:  ${m.MessageHeader?.MessageReference?.MessageDateTime}`);
    console.log(`train ID identifiers (${tiList.length} variants, picked operating TOC):`);
    console.log(`  ObjectType:   ${ti.ObjectType}`);
    console.log(`  Company:      ${ti.Company}     (TOC numeric)`);
    console.log(`  Core:         ${ti.Core}        ← Darwin RID join candidate`);
    console.log(`  Variant:      ${ti.Variant}`);
    console.log(`  StartDate:    ${ti.StartDate}`);
    console.log(`OperationalTrainNumber: ${otn.OperationalTrainNumber}  (= headcode)`);
    console.log(`ScheduledTimeAtHandover: ${otn.ScheduledTimeAtHandover}`);
    console.log(`responsibleRU: ${m.ResponsibleRU}`);
    console.log(`allocations:   ${allocs.length}`);
    for (const [i, a] of allocs.entries()) {
      const rgList   = a.ResourceGroup || [];
      const orig = txt(a.AllocationOriginLocation?.LocationSubsidiaryIdentification?.LocationSubsidiaryCode);
      const dest = txt(a.AllocationDestinationLocation?.LocationSubsidiaryIdentification?.LocationSubsidiaryCode);
      console.log(`  alloc #${i + 1}: seq=${a.AllocationSequenceNumber}  pos=${a.ResourceGroupPosition}  ${orig} → ${dest}  reversed=${a.Reversed}`);
      console.log(`    times:   ${a.AllocationOriginDateTime} → ${a.AllocationDestinationDateTime}  (${a.AllocationDestinationMiles} mi)`);
      console.log(`    diagram: ${a.DiagramNo} (${a.DiagramDate})`);
      for (const rg of rgList) {
        const vehicles = rg.Vehicle || [];
        const totalSeats = vehicles.reduce((sum, v) => sum + (Number(v.NumberOfSeats) || 0), 0);
        console.log(`    resource group: ${rg.ResourceGroupId}  fleet=${rg.FleetId}  type=${rg.TypeOfResource}  status=${rg.ResourceGroupStatus}  → ${totalSeats} seats total`);
        for (const v of vehicles) {
          const defs = (v.Defect || []).length;
          const name = v.VehicleName ? ` "${v.VehicleName}"` : '';
          console.log(`      pos${v.ResourcePosition}: ${v.VehicleId}${name} (${v.SpecificType}) ${v.NumberOfSeats} seats, ${v.MaximumSpeed} mph, brake=${v.TrainBrakeType}, cabs=${v.Cabs}, cat=${v.RegisteredCategory}${defs ? `, ${defs} defect(s)` : ''}`);
          for (const d of (v.Defect || [])) {
            console.log(`        ⚠  ${d.DefectCode}@${d.MaintenanceDefectLocation} [${d.DefectStatus}]: ${(d.DefectDescription || '').replace(/\n/g, ' ')}`);
          }
        }
      }
    }
    if (process.env.DUMP_RAW === '1') {
      console.log('\n--- raw parsed JSON ---');
      console.log(JSON.stringify(doc, null, 2));
    }
  },
});

// Apply the replay seek now that consumer.run has registered partitions.
// Small delay so the partition assignment is settled.
if (replayOffsets) {
  await new Promise((r) => setTimeout(r, 1500));
  for (const o of replayOffsets) {
    try {
      consumer.seek({ topic: process.env.PTAC_TOPIC, partition: o.partition, offset: o.offset });
      console.log(`[probe] sought p${o.partition} → offset ${o.offset}`);
    } catch (e) { console.warn(`[probe] seek p${o.partition} failed: ${e.message}`); }
  }
}

setTimeout(async () => {
  console.log(`\n[done] captured ${captured} message(s) in ${RUN_SEC}s.`);
  if (captured === 0) {
    console.log('No messages received. PTAC traffic is sporadic outside peak allocation windows.');
    console.log('Try again at 05:00 UK (start-of-day) or use RUN_SEC=60 for a longer probe.');
  }
  await consumer.disconnect();
  process.exit(0);
}, RUN_SEC * 1000 + 1000);
