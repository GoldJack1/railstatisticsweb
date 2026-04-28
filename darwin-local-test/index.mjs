#!/usr/bin/env node
/*
 * Darwin Push Port — Leeds live departures local test.
 *
 * Connects to Confluent Cloud Kafka, consumes a Darwin topic (JSON or XML),
 * decodes the `<Pport>` payload, and prints departures calling at Leeds.
 *
 * Standalone: this file is NOT imported by the website. Its deps live in
 * ./package.json only.
 *
 * Payload handling per topic (from docs/Darwin guides/*):
 *   -JSON:  Kafka value is a JSON envelope; `bytes` is a JSON *string* of the
 *           Pport object (no base64, no gzip). We JSON.parse it directly.
 *   -XML:   Kafka value is a JSON envelope; `bytes` is base64 of XML (may be
 *           gzipped). We base64-decode, optionally gunzip, then XML-parse.
 *   -AVRO:  Requires Confluent Schema Registry credentials — not implemented
 *           here; the script will exit with guidance if selected.
 */

import { Kafka, logLevel } from 'kafkajs';
import { XMLParser } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const cfg = {
  bootstrap:   process.env.DARWIN_BOOTSTRAP   || 'pkc-z3p1v0.europe-west2.gcp.confluent.cloud:9092',
  mechanism:   (process.env.DARWIN_SASL_MECHANISM || 'plain').toLowerCase(),
  username:    process.env.DARWIN_USERNAME,
  password:    process.env.DARWIN_PASSWORD,
  topic:       process.env.DARWIN_TOPIC       || 'prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON',
  format:      (process.env.DARWIN_PAYLOAD_FORMAT || inferFormatFromTopic(process.env.DARWIN_TOPIC)).toLowerCase(),
  groupId:     process.env.DARWIN_GROUP_ID    || 'SC-7b1e1122-f920-4c79-9235-2c27a16aa7ca',
  tiploc:      (process.env.DARWIN_LEEDS_TIPLOC || 'LEEDS').toUpperCase(),
  crs:         (process.env.DARWIN_LEEDS_CRS    || 'LDS').toUpperCase(),
  duration:    Number(process.env.DARWIN_TEST_DURATION_SEC || 120),
  fromBeginning: String(process.env.DARWIN_FROM_BEGINNING || 'false').toLowerCase() === 'true',
  dumpFirst:   String(process.env.DARWIN_DUMP_FIRST_XML || '0') === '1',
};

function inferFormatFromTopic(topic) {
  if (!topic) return 'json';
  const t = topic.toUpperCase();
  if (t.endsWith('-AVRO')) return 'avro';
  if (t.endsWith('-XML')) return 'xml';
  return 'json';
}

if (!cfg.username || !cfg.password) {
  console.error('[darwin] Missing DARWIN_USERNAME / DARWIN_PASSWORD. Copy .env.example to .env and fill them in.');
  process.exit(1);
}
if (cfg.format === 'avro') {
  console.error('[darwin] AVRO topic needs Confluent Schema Registry credentials — not configured.');
  console.error('         Switch DARWIN_TOPIC / DARWIN_PAYLOAD_FORMAT to the JSON or XML topic, or add registry support.');
  process.exit(2);
}
if (cfg.format !== 'json' && cfg.format !== 'xml') {
  console.error(`[darwin] Unknown DARWIN_PAYLOAD_FORMAT=${cfg.format} (expected json | xml | avro)`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

// Darwin XML uses varying namespace prefixes (ns0:, ns5:, fc:, ct:). Strip them.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
});

// IMPORTANT: per Rail Data Marketplace, "Clients receive only the data value".
// The "envelope" shapes shown in docs/Darwin guides/darwin-base-schema.json and
// darwin-json-and-avro-schema.json describe the RDM *web preview*, not what
// arrives over Kafka. On the wire:
//   - JSON topic: message value is the raw Pport JSON object (UTF-8 text).
//   - XML  topic: message value is the raw Pport XML (UTF-8 text), possibly gzipped.
//   - Legacy/preview: a JSON envelope { ..., "bytes": "<json-or-base64>" }.
// We auto-detect.

function tryGunzip(buf) {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try { return gunzipSync(buf); } catch { /* fall through */ }
  }
  return null;
}

function normaliseJsonPport(obj) {
  if (!obj) return null;
  if (obj.Pport) return obj;
  if (obj.uR || obj.sR) return { Pport: obj };
  // Some serialisations attach the Pport attributes at top level alongside uR/sR.
  return { Pport: obj };
}

function decodeKafkaValue(rawBuf) {
  // 1) Try gzip first (XML topic may be gzipped per Darwin spec).
  const unz = tryGunzip(rawBuf);
  const buf = unz || rawBuf;
  const text = buf.toString('utf8');
  const trimmed = text.trimStart();

  // 2) Raw XML?
  if (trimmed.startsWith('<')) {
    return { kind: 'xml', xml: text, parsed: xmlParser.parse(text) };
  }

  // 3) Raw JSON?
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const obj = JSON.parse(text);
    // Could be either the raw Pport JSON, or a legacy envelope with `bytes`.
    if (obj && typeof obj.bytes === 'string') {
      // Envelope path: bytes may itself be JSON text, base64 of XML, or base64 of gzipped XML.
      const inner = obj.bytes;
      const innerTrim = inner.trimStart();
      if (innerTrim.startsWith('{') || innerTrim.startsWith('[')) {
        return { kind: 'json', parsed: normaliseJsonPport(JSON.parse(inner)) };
      }
      if (innerTrim.startsWith('<')) {
        return { kind: 'xml', xml: inner, parsed: xmlParser.parse(inner) };
      }
      // Assume base64
      const innerBuf = Buffer.from(inner, 'base64');
      const innerUnz = tryGunzip(innerBuf) || innerBuf;
      const innerText = innerUnz.toString('utf8');
      if (innerText.trimStart().startsWith('<')) {
        return { kind: 'xml', xml: innerText, parsed: xmlParser.parse(innerText) };
      }
      return { kind: 'json', parsed: normaliseJsonPport(JSON.parse(innerText)) };
    }
    return { kind: 'json', parsed: normaliseJsonPport(obj) };
  }

  // 4) Possibly base64 of something. Try.
  try {
    const decoded = Buffer.from(text, 'base64');
    const decUnz = tryGunzip(decoded) || decoded;
    const decText = decUnz.toString('utf8');
    if (decText.trimStart().startsWith('<')) {
      return { kind: 'xml', xml: decText, parsed: xmlParser.parse(decText) };
    }
    if (decText.trimStart().startsWith('{')) {
      return { kind: 'json', parsed: normaliseJsonPport(JSON.parse(decText)) };
    }
  } catch { /* fall through */ }

  return { kind: 'unknown', raw: text };
}

// ---------------------------------------------------------------------------
// Darwin walker
// ---------------------------------------------------------------------------

function asArray(x) {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function classifyTypes(pport) {
  const out = new Set();
  for (const envelope of ['uR', 'sR']) {
    const env = pport?.[envelope];
    if (!env) continue;
    for (const k of Object.keys(env)) {
      if (k === 'updateOrigin' || k === 'requestSource' || k === 'requestID') continue;
      out.add(k);
    }
  }
  return [...out];
}

function plainText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v['#text'] || v._ || '';
  return String(v);
}

function pickTime(loc) {
  return (
    loc?.dep?.at ||
    loc?.dep?.et ||
    loc?.pass?.at ||
    loc?.pass?.et ||
    loc?.ptd ||
    loc?.wtd ||
    loc?.pta ||
    loc?.wta ||
    null
  );
}

function statusLabel(loc) {
  if (loc?.dep?.at) return `actual ${loc.dep.at}`;
  if (loc?.dep?.et) return `est ${loc.dep.et}`;
  if (loc?.arr?.at) return `arrived ${loc.arr.at}`;
  if (loc?.pass?.at) return `passed ${loc.pass.at}`;
  if (loc?.pass?.et) return `pass est ${loc.pass.et}`;
  return 'scheduled';
}

function extractLeedsMatches(pport, tiploc) {
  const matches = [];
  for (const envelope of ['uR', 'sR']) {
    const env = pport?.[envelope];
    if (!env) continue;

    for (const ts of asArray(env.TS)) {
      const rid = ts.rid;
      const ssd = ts.ssd;
      for (const loc of asArray(ts.Location)) {
        if ((loc.tpl || '').toUpperCase() !== tiploc) continue;
        if (!loc.dep && !loc.pass && !loc.ptd && !loc.wtd) continue;
        matches.push({
          kind: 'TS',
          rid, ssd,
          tpl: loc.tpl,
          plat: plainText(loc.plat),
          time: pickTime(loc),
          status: statusLabel(loc),
        });
      }
    }

    for (const sc of asArray(env.SC)) {
      const locs = asArray(sc.OR).concat(asArray(sc.IP)).concat(asArray(sc.PP)).concat(asArray(sc.DT));
      const leedsLoc = locs.find((l) => (l.tpl || '').toUpperCase() === tiploc);
      if (!leedsLoc) continue;
      const destination = asArray(sc.DT)[0]?.tpl || locs[locs.length - 1]?.tpl || '';
      matches.push({
        kind: 'SC',
        rid: sc.rid,
        ssd: sc.ssd,
        toc: sc.toc,
        destination,
        tpl: leedsLoc.tpl,
        plat: plainText(leedsLoc.plat),
        time: leedsLoc.ptd || leedsLoc.wtd || leedsLoc.pta || leedsLoc.wta || '',
        status: 'schedule',
      });
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Kafka consumer
// ---------------------------------------------------------------------------

const kafka = new Kafka({
  clientId: 'rs-darwin-local-test',
  brokers: [cfg.bootstrap],
  ssl: true,
  sasl: {
    mechanism: cfg.mechanism, // 'plain'
    username: cfg.username,
    password: cfg.password,
  },
  connectionTimeout: 15000,
  authenticationTimeout: 15000,
  logLevel: process.env.DARWIN_LOG === 'debug' ? logLevel.DEBUG : process.env.DARWIN_LOG === 'info' ? logLevel.INFO : logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: cfg.groupId });

let consumed = 0;
let leedsMsgs = 0;
let firstDumped = false;
const uniqueRids = new Set();
// Per-partition message counts, last-seen Pport sequence (if present in JSON
// payload as `sequence` / not always exposed), and gap counts.
const perPartition = new Map(); // partition -> { count, firstOffset, lastOffset, lastTs }

async function main() {
  console.log(`[darwin] topic=${cfg.topic} format=${cfg.format}`);
  console.log(`[darwin] connecting to ${cfg.bootstrap} as ${cfg.username} ...`);
  await consumer.connect();
  await consumer.subscribe({ topic: cfg.topic, fromBeginning: cfg.fromBeginning });
  console.log(`[darwin] subscribed (group ${cfg.groupId})`);
  console.log(`[darwin] waiting for messages (${cfg.duration}s) ...`);

  const stopAt = Date.now() + cfg.duration * 1000;
  const timer = setTimeout(() => shutdown('duration reached'), cfg.duration * 1000);

  await consumer.run({
    eachMessage: async ({ message, partition }) => {
      consumed++;
      if (Date.now() > stopAt) return;

      // Track per-partition activity (partition key is messageID per Peter Hicks
      // 19 Sep 2025 on openraildata-talk; same RID can land on either partition).
      const pp = perPartition.get(partition) || { count: 0, firstOffset: message.offset, lastOffset: message.offset };
      pp.count++;
      pp.lastOffset = message.offset;
      perPartition.set(partition, pp);

      let decoded;
      try {
        decoded = decodeKafkaValue(message.value);
      } catch (e) {
        if (consumed <= 5) console.warn('[darwin] decode error:', e.message);
        return;
      }

      if (cfg.dumpFirst && !firstDumped && decoded.kind !== 'unknown') {
        firstDumped = true;
        if (decoded.kind === 'xml') {
          const out = resolve(__dirname, 'first-message.xml');
          writeFileSync(out, decoded.xml);
          console.log(`[darwin] dumped first decoded XML → ${out} (${decoded.xml.length} bytes)`);
        } else {
          const out = resolve(__dirname, 'first-message.json');
          writeFileSync(out, JSON.stringify(decoded.parsed, null, 2));
          console.log(`[darwin] dumped first decoded JSON → ${out}`);
        }
      }

      if (decoded.kind === 'unknown') {
        if (consumed <= 3) console.warn('[darwin] unknown payload shape, head:', String(decoded.raw).slice(0, 120));
        return;
      }
      const pport = decoded.parsed?.Pport;
      if (!pport) return;

      if (consumed % 100 === 0) {
        console.log(`[darwin] ${consumed} consumed, types in last: ${classifyTypes(pport).join(',') || 'n/a'}`);
      }

      const matches = extractLeedsMatches(pport, cfg.tiploc);
      if (matches.length === 0) return;

      leedsMsgs++;
      for (const m of matches) {
        if (m.rid) uniqueRids.add(m.rid);
        const plat = m.plat ? ` plat=${m.plat}` : '';
        const part = `p${partition}@${message.offset}`;
        if (m.kind === 'TS') {
          console.log(`[leeds:TS] ${m.time || '--:--'} tpl=${m.tpl} rid=${m.rid}${plat} (${m.status}) [${part}]`);
        } else {
          console.log(`[leeds:SC] ${m.time || '--:--'} tpl=${m.tpl} rid=${m.rid}${plat} toc=${m.toc || '?'} → ${m.destination || '?'} [${part}]`);
        }
      }
    },
  });

  await new Promise((res) => {
    process.on('SIGINT', () => { clearTimeout(timer); shutdown('SIGINT').then(res); });
    timer.unref?.();
  });
}

let shuttingDown = false;
async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[darwin] stopping (${reason}) ...`);
  try { await consumer.disconnect(); } catch (e) { console.warn('[darwin] disconnect error:', e.message); }
  console.log('---- summary ----');
  console.log(`topic:                    ${cfg.topic}`);
  console.log(`format:                   ${cfg.format}`);
  console.log(`messages consumed:        ${consumed}`);
  console.log(`messages with Leeds hits: ${leedsMsgs}`);
  console.log(`unique Leeds rids:        ${uniqueRids.size}`);
  if (perPartition.size > 0) {
    const parts = [...perPartition.entries()].sort((a, b) => a[0] - b[0]);
    console.log('per-partition:');
    for (const [p, info] of parts) {
      console.log(`  p${p}: ${info.count} msgs, offsets ${info.firstOffset}..${info.lastOffset}`);
    }
    // As of probing 2026-04-28, all three Darwin topics (JSON/XML/AVRO) have
    // exactly 1 partition. The openraildata-talk discussion (oth6M9vnsKU,
    // Jun-Oct 2025) about 2-partition out-of-order risk no longer applies.
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[darwin] fatal:', err);
  shutdown('error').then(() => process.exit(1));
});
