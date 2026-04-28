# Darwin Local Test

Isolated Node.js scripts that explore the National Rail **Darwin Push Port**
feed (Confluent Cloud Kafka) and the daily **Push Port Timetable** files
(XML.gz). Has its own `package.json`; does **not** touch the website source or
its dependencies.

Four scripts, one shared timetable loader. Pick whichever fits the question.

| script                      | npm command         | what it does                                              |
|-----------------------------|---------------------|-----------------------------------------------------------|
| `index.mjs`                 | `npm run leeds`     | Kafka smoke test — prints live Leeds matches for ~60 s.   |
| `leeds-next-hour.mjs`       | `npm run leeds:hour`| Kafka-only departure board (no timetable file needed).    |
| `leeds-departures.mjs`      | `npm run leeds:full`| **Recommended.** Timetable file + live Kafka overlay.     |
| `service-detail.mjs`        | `npm run service`   | Full per-service detail (every calling point + live).     |
| `probe-topic.mjs`           | `node probe-topic.mjs` | Prints partition count / leaders. Diagnostic only.    |

---

## 1. One-time setup

From this folder (`darwin-local-test/`):

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| variable             | source                                                         |
|----------------------|----------------------------------------------------------------|
| `DARWIN_BOOTSTRAP`   | from `docs/Darwin guides/Credentials.md`                       |
| `DARWIN_TOPIC`       | the JSON topic — pre-filled in `.env.example`                  |
| `DARWIN_GROUP_ID`    | issued by RDM with your subscription                           |
| `DARWIN_USERNAME`    | Confluent API key (a.k.a. "Consumer username")                 |
| `DARWIN_PASSWORD`    | Confluent API secret (a.k.a. "Consumer password")              |

`.env` is gitignored. **Never commit credentials.**

### Timetable files

The board and service-detail scripts need today's PPTimetable XML.gz file.
Drop it into one of these folders (the loader checks both):

```
docs/V8s/                  ← preferred (v8 schema, full passing-point data)
docs/timetablefiles/        ← fallback (older v5/v6/v7 schemas also work)
```

File naming: `PPTimetable_YYYYMMDDhhmmss_v{N}.xml.gz`. The loader auto-picks
today's file with the **highest version number**.

---

## 2. Daily usage

### Live departure board for any TIPLOC

```bash
# Default: Leeds, next 60 minutes from now, with 30 s of live overlay
npm run leeds:full

# Different station
DARWIN_LEEDS_TIPLOC=YORK npm run leeds:full
DARWIN_LEEDS_TIPLOC=KNGX npm run leeds:full

# Different time window today (HH:MM, 24 h)
DARWIN_LEEDS_TIPLOC=DWBY WINDOW_START=15:00 WINDOW_END=16:00 npm run leeds:full

# Wider "next N minutes" instead of fixed window
LEEDS_WINDOW_MIN=120 npm run leeds:full

# Skip Kafka entirely (timetable only — instant, useful offline)
LIVE_SEC=0 npm run leeds:full

# Longer live overlay (catches more services that haven't been forecast in last 30 s)
LIVE_SEC=120 npm run leeds:full

# Pin to a specific timetable file
LEEDS_TIMETABLE=/full/path/to/PPTimetable_20260428020459_v8.xml.gz npm run leeds:full
```

Output is a sorted board: `time · plat · trainId · TOC · status · origin → destination · calling pattern`.

### Detail view for a single service

```bash
# By RID (fastest if you know it — copy from the board output)
RID=202604287192109 npm run service

# By TIPLOC + scheduled departure time
AT=DWBY TIME=15:34 npm run service
AT=KNGX TIME=18:30 npm run service
AT=YORK TIME=09:15 LIVE_SEC=60 npm run service
```

Prints:
1. Header (rid, uid, trainId, TOC, category, passenger flag).
2. Full chronological calling pattern — every `OR / IP / PP / DT` location
   with public + working times and activity codes.
3. Live overlay table (if the service is currently active or near-future):
   scheduled vs live arrivals/departures, with a `delta` column showing
   on-time / early / late by minute.

Live overlay is auto-skipped when the service is fully in the past (no
forecasts to merge).

### Pure Kafka smoke tests (no timetable file needed)

```bash
npm run leeds         # 60 s of live messages, prints Leeds-matching TS rows
npm run leeds:hour    # next-60-min board built ONLY from Kafka history+live
```

These are useful when you want to verify the Kafka pipe is healthy independently
of the timetable file workflow.

---

## 3. Common modifications — recipes

### Filter to a different station

Everything is keyed on **TIPLOC** (Darwin's internal location codes — *not*
the 3-letter CRS codes the public sees). Common ones:

| TIPLOC    | station                       |
|-----------|-------------------------------|
| `LEEDS`   | Leeds                         |
| `YORK`    | York                          |
| `MNCRPIC` | Manchester Piccadilly         |
| `MNCRVIC` | Manchester Victoria           |
| `KNGX`    | London Kings Cross            |
| `EUSTON`  | London Euston                 |
| `BRGHTN`  | Brighton                      |
| `EDINBUR` | Edinburgh                     |
| `LVRPLSH` | Liverpool Lime Street         |
| `BHMNWS`  | Birmingham New Street         |

Full list lives in the **`_ref_v*.xml.gz` reference files** in `docs/timetablefiles/`
(TIPLOC ↔ CRS ↔ name). If you want human-readable names in the output, that's
the lookup source.

```bash
DARWIN_LEEDS_TIPLOC=BHMNWS npm run leeds:full
```

### Change the time window

```bash
# next 2 hours
LEEDS_WINDOW_MIN=120 npm run leeds:full

# fixed window today
WINDOW_START=07:00 WINDOW_END=09:00 npm run leeds:full   # peak inbound
WINDOW_START=16:30 WINDOW_END=19:00 npm run leeds:full   # peak outbound
```

### Use a different schedule activity filter

`leeds-departures.mjs` line ~140 currently excludes `act === 'TF'`
(terminating arrivals). Open it and tweak if you want to include arrivals,
freight (`isPassengerSvc === 'false'`), or empty-stock moves (`trainCat === 'EE'`):

```javascript
// drop these lines to include terminating arrivals
if (sc.activity === 'TF') continue;

// or filter to passenger services only
if (!sc.isPassenger) continue;
```

### Fetch a different topic (XML or AVRO)

```bash
# .env or one-off:
DARWIN_TOPIC=prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-XML  npm run leeds
```

XML decoding is built into `index.mjs` (auto-detects gzipped XML payloads).
AVRO requires Confluent Schema Registry credentials; not implemented here.

### Replay older Kafka messages

For `leeds-next-hour.mjs` (the Kafka-only board) you can ask the script to seek
back in time before listening:

```bash
LEEDS_REPLAY_MIN=120 npm run leeds:hour   # rewind 2 hours of retained messages
```

Kafka retention on Confluent Cloud is typically 24-72 h. Useful for catching
`schedule` and `deactivated` (cancellation) messages that fired earlier today.

### Inspect a raw message

```bash
DARWIN_DUMP_FIRST_XML=1 npm run leeds
```

The first decoded payload is written to `first-message.xml` (or `.json`) for
offline inspection. Useful when fields don't look right.

### Add a new derived field to the board

The per-service object built by `leeds-departures.mjs` lives in
`departureRows`. Add fields in the loop around line ~150 and surface them in
the printed table around line ~250. Same pattern in `service-detail.mjs`.

---

## 4. How the data flows (mental model)

```
   ┌─────────────────────────────┐         ┌──────────────────────────────┐
   │ daily PPTimetable_*_v8.xml.gz │       │ Kafka Push Port (live JSON)  │
   │ source of truth: schedule    │       │ source: forecasts + actuals  │
   └────────────┬────────────────┘         └─────────────┬────────────────┘
                │                                         │
                ▼                                         ▼
          timetable-loader.mjs                       index.mjs decoder
                │                                         │
                ▼                                         ▼
        Map<rid, schedule>     ◀── merge by rid ──▶ Map<rid, liveState>
                │
                ▼
      leeds-departures.mjs / service-detail.mjs
```

Key points:

- **Schedule** (timetable file) gives every train a structure: TOC, trainId,
  origin, destination, all calling points with times and activity codes.
  Static for the day (snapshotted around 02:04 UTC).
- **Push Port** is *event-driven* — it broadcasts a `TS` (Train Status)
  message every time Darwin updates its forecast or records an actual time at
  a sensor. It does NOT broadcast a service unless something changes.
- **`schedule` messages** on the Push Port are emitted only when a service's
  schedule **changes** (new train, retiming, cancellation). Most services'
  full schedules are already in the timetable file, not the live stream.
- This is why the **timetable file + live overlay** model is the right one.
  Pure-Kafka scripts can replay history but can't reconstruct a daily
  schedule completely.

---

## 5. JSON wire format gotchas (verified 2026-04-28)

The JSON Push Port topic differs from the XML XSD in non-obvious ways. The
decoders here already handle these — listed for future maintainers:

| XML XSD                     | JSON wire form                |
|-----------------------------|-------------------------------|
| `<SC>` (schedule)           | `e.schedule`                  |
| `<AS>` (association)        | `e.association`               |
| `<DeactivatedSchedule>`     | `e.deactivated`               |
| `<LO>` (loading)            | `e.formationLoading`          |
| `<TS>` (train status)       | `e.TS` (case preserved)       |
| Calling points (passenger)  | `OR / IP / PP / DT`           |
| Calling points (freight/ECS)| `OPOR / OPIP / OPPP / OPDT`   |
| `<plat>3A</plat>`           | `{ platsrc, conf, "": "3A" }` |

All messages are wrapped in an envelope (`{ destination, messageID, bytes, ...}`)
where the inner Pport JSON is in the **stringified** `bytes` field. Decoders
in `index.mjs` and `service-detail.mjs` unwrap this transparently.

---

## 6. Troubleshooting

| symptom                                          | likely cause / fix                                                                  |
|--------------------------------------------------|-------------------------------------------------------------------------------------|
| `SASL authentication failed`                     | Wrong key/secret, or your subscription expired. Re-check RDM.                       |
| `topic authorization failed`                     | Group ID mismatch (`DARWIN_GROUP_ID` must match what RDM issued you).               |
| Stuck on `subscribed` with `memberAssignment:{}` | Another consumer in the same group is holding the partition. Identify with `lsof -nP -i TCP:9092` and stop it. |
| `Schedule data captured for 0`                   | Group has committed offsets at "latest". Use `LEEDS_REPLAY_MIN=...` for `leeds:hour`, or use `leeds:full` (timetable). |
| 0 services in the board                          | Timetable file for today missing — drop into `docs/V8s/`. Or window is empty.       |
| `[object Object]` in plat column                 | Use the latest `service-detail.mjs` — early version had a bug, fixed.               |
| `no timetable file for today`                    | Loader looked in `docs/V8s/` and `docs/timetablefiles/`. Add a file there or pass `LEEDS_TIMETABLE=`. |
| TLS hostname mismatch when listing legacy bucket | Pre-RDM `darwin.xmltimetable` bucket — IP-whitelisted, likely retired. Use the v8 files RDM provides instead. |

---

## 7. Topic partitioning (current state)

Probed via `node probe-topic.mjs` on 2026-04-28: **all three Darwin topics
(`-JSON`, `-XML`, `-AVRO`) have exactly 1 partition.**

Historical note: the openraildata-talk thread `oth6M9vnsKU` (Jun-Oct 2025)
discussed 2-partition out-of-order delivery and per-partition sequence-gap
tracking. That issue no longer applies with the current 1-partition layout —
ordering by `Pport@ts` is global, and a single sequence-number counter is
sufficient to detect missed messages.

Re-run `node probe-topic.mjs` if you suspect this has changed again.

---

## 8. File reference

| file                         | purpose                                                                  |
|------------------------------|--------------------------------------------------------------------------|
| `index.mjs`                  | Pure Kafka smoke test (Leeds matches over a fixed window).               |
| `leeds-next-hour.mjs`        | Kafka-only board, with manual replay-from-N-minutes-ago seek.            |
| `leeds-departures.mjs`       | **Main board.** Timetable + live overlay.                                |
| `service-detail.mjs`         | Single-service detail, all calling points, scheduled vs live diff.       |
| `timetable-loader.mjs`       | Schema-aware (v5/v6/v7/v8) regex-prefiltered XML parser.                 |
| `probe-topic.mjs`            | Prints partition count and leaders. Diagnostic.                          |
| `sample-types.mjs`           | (debug) Captures one example of each Pport message type.                 |
| `dump-raw.mjs`               | (debug) Dumps first N raw Kafka envelopes to `raw-samples.json`.         |
| `package.json`               | Isolated deps: `kafkajs`, `fast-xml-parser`, `dotenv`.                   |
| `.env.example`               | Copy → `.env` and fill in credentials.                                   |
| `first-message.json/.xml`    | Generated when `DARWIN_DUMP_FIRST_*=1`. Inspect in your editor.          |
| `type-samples.json`          | Generated by `sample-types.mjs`. One example of every observed type.     |
| `raw-samples.json`           | Generated by `dump-raw.mjs`. Raw envelopes for low-level debugging.      |

---

## 9. Future work

- **Historical service performance** — separate RDM product (subscription
  pending). Once approved, will let `leeds:full` and `service` answer
  retrospective queries (e.g. "how late did the 15:34 from Dewsbury actually
  arrive at Wigan?") instead of just showing scheduled times.
- **CRS / human-name resolution** — the `_ref_v*.xml.gz` reference files
  contain TIPLOC ↔ CRS ↔ name mappings. Worth ingesting once and exposing
  human-readable origins/destinations in the board.
- **Continuous JSON output** — write the rolling state to a file every few
  seconds so the website (or anything else) can read it without coupling.
- **Cancellation reasons** — `deactivated` messages carry reason codes;
  surface them in the board as `CANCELLED (signal failure)` etc.
