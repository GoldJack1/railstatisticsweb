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
| `leeds-departures.mjs`      | `npm run leeds:full`| **Recommended.** Timetable + live Kafka + cancellation reasons. |
| `service-detail.mjs`        | `npm run service`   | Full per-service detail (every calling point + live).     |
| `departures-daemon.mjs`     | `npm run daemon`    | **Long-running.** Writes a rolling JSON snapshot every N s for the website to poll. |
| `probe-topic.mjs`           | `node probe-topic.mjs` | Prints partition count / leaders. Diagnostic only.    |
| `probe-cancellations.mjs`   | `node probe-cancellations.mjs` | Prints every cancellation observed across the whole feed. |

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

# Replay the last 6 hours of retained Kafka messages (catches cancellations
# announced earlier today that wouldn't appear in a short live window).
REPLAY_MIN=360 LIVE_SEC=30 npm run leeds:full
```

Output is a sorted board: `time · plat · trainId · TOC · status · origin → destination · calling pattern`.

**Cancellations** appear on a second indented line with the decoded reason, e.g.

```
19:39  1  2V61  GN  CANCELLED  WLWYNGC → MRGT
       ↳ reason: This service has been cancelled because of a fault on this train  [schedule]
```

Reason sources (the `[...]` tag at the end):

| source            | where the reason came from                                                      |
|-------------------|---------------------------------------------------------------------------------|
| `[schedule]`      | a `schedule` message with top-level `cancelReason` (most common)                |
| `[schedule-loc]`  | per-location `can="true"` in a schedule message (partial cancel)                |
| `[ts]`            | a `TS` message with top-level `cancelReason`/`lateReason`                       |
| `[ts-loc]`        | a `TS` message location-level cancel/late reason                                |
| `[ts-loc-can]`    | a `TS` location with `can="true"` (in-running partial cancel at this stop)      |
| `[deactivated]`   | the whole schedule was deactivated — no reason code carried by the message     |

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

### Continuous JSON output for the website (`daemon`)

The one-shot board scripts exit after a single listen. For a **live website**
you want a long-running process that keeps rolling state and writes a snapshot
file the web code can poll without touching Kafka itself.

```bash
# single station
TIPLOC=LEEDS npm run daemon

# multiple stations — each writes its own file
TIPLOC=LEEDS npm run daemon &
TIPLOC=YORK  npm run daemon &
TIPLOC=KNGX  npm run daemon &

# tune
TIPLOC=DWBY WINDOW_HOURS=4 WRITE_INTERVAL_SEC=2 INITIAL_REPLAY_MIN=720 npm run daemon
```

Output file: `darwin-local-test/state/<tiploc>-departures.json` (atomic writes
via `.tmp` + `rename` — readers never see a half-written file).

Key behaviours:

- **Rolling window** — as the clock moves forward, services slide in and out
  of the snapshot without restart.
- **Day rollover** — at midnight the daemon detects the date change and
  reloads today's timetable + reasons file. Retries every 5 min if the new
  file hasn't been dropped yet.
- **Initial replay** — on startup, rewinds `INITIAL_REPLAY_MIN` minutes
  (default 360) so today's earlier cancellations are already in state by the
  time the first snapshot is written.
- **Heartbeat log** — every `HEARTBEAT_SEC` seconds (default 60) prints
  counts + last Kafka message time. `tail -f` the output to check health.
- **Graceful shutdown** — SIGINT/SIGTERM writes a final snapshot before exit.
- **Crash-tolerant** — one malformed Kafka message won't kill the daemon.

Env vars (all optional):

| var                     | default                                | meaning                                           |
|-------------------------|----------------------------------------|---------------------------------------------------|
| `TIPLOC`                | `LEEDS`                                | station to track                                  |
| `WINDOW_HOURS`          | `3`                                    | look-ahead in hours                               |
| `WRITE_INTERVAL_SEC`    | `5`                                    | snapshot write interval                           |
| `INITIAL_REPLAY_MIN`    | `360`                                  | minutes of Kafka to replay on startup             |
| `HEARTBEAT_SEC`         | `60`                                   | stats log interval                                |
| `OUTPUT_FILE`           | `state/<tiploc>-departures.json`       | override output path                              |

Website-side polling pattern:

```js
const snap = JSON.parse(await fs.readFile('darwin-local-test/state/leeds-departures.json'));
const age = Date.now() - Date.parse(snap.updatedAt);
if (age > 30_000) showStaleBadge();
renderBoard(snap.departures);
```

Schema for each row in `departures[]`:

```ts
{
  rid: string;
  trainId: string;              // 4-char headcode, e.g. "1A28"
  uid: string;
  toc: string;                  // 2-char operator code
  scheduledTime: string;        // "HH:MM"
  scheduledAt: string;          // ISO timestamp anchored to today
  liveTime: string;             // latest best-known departure time
  liveKind: 'scheduled'|'working'|'est'|'actual';
  platform: string|null;        // scheduled platform
  livePlatform: string|null;    // overlaid platform if changed
  origin: string;               // TIPLOC
  destination: string;          // TIPLOC
  callingAfter: string[];       // TIPLOCs in order after this stop

  // Human-readable names and CRS codes (from ref_v*.xml.gz).
  // Parallel arrays align with callingAfter; null for junctions/sidings.
  tocName:              string|null;
  originName:           string|null;
  originCrs:            string|null;
  destinationName:      string|null;
  destinationCrs:       string|null;
  callingAfterNames:    Array<string|null>;
  callingAfterCrs:      Array<string|null>;

  isPassenger: boolean;
  cancelled: boolean;
  cancellation: { code?, source, reason }|null;
  delayReason:  { code?, source, reason }|null;
  status: string;               // convenience: "on time"|"CANCELLED"|"est HH:MM"|...
}
```

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

### Replay older Kafka messages (catch earlier cancellations)

Most cancellations are announced by a **single `schedule` message** emitted
when the decision is made — sometimes hours before the train was due. A short
live window won't catch them. Seek backward to replay retained messages:

```bash
# main board: rewind 6 hours before listening
REPLAY_MIN=360 LIVE_SEC=60 npm run leeds:full

# full 24-hour replay (catches everything retained on the broker)
REPLAY_MIN=1440 LIVE_SEC=10 npm run leeds:full

# Kafka-only board (older script, uses LEEDS_REPLAY_MIN instead of REPLAY_MIN)
LEEDS_REPLAY_MIN=120 npm run leeds:hour
```

Trade-off: `REPLAY_MIN=360` typically pulls ~100-150 k messages in 60-90 s
(~1,500 msg/s on the local link). The script handles this fine but it is
noisy. For a long-running production consumer you'd want a stateful process
that keeps rolling state instead of replaying on each launch.

Kafka retention on Confluent Cloud is typically 24-72 h.

### Verify cancellation decoding end-to-end

```bash
CANCEL_SEC=120 node probe-cancellations.mjs
```

Listens across the **whole feed** (any TIPLOC) for 120 s and prints every
cancellation / late-reason event it observes, with the code decoded against
the local reference tables. Useful when the main board says 0 cancellations
and you want to confirm the decoder works.

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
| `departures-daemon.mjs`      | **Long-running** rolling snapshot writer for the website. Writes `state/<tiploc>-departures.json` every few seconds. |
| `timetable-loader.mjs`       | Schema-aware (v5/v6/v7/v8) regex-prefiltered XML parser.                 |
| `reasons-loader.mjs`         | Loads LateRunningReasons + CancellationReasons from `_ref_v*.xml.gz`.    |
| `locations-loader.mjs`       | Loads LocationRef (TIPLOC↔CRS↔name) + TocRef (operator code↔name).         |
| `probe-topic.mjs`            | Prints partition count and leaders. Diagnostic.                          |
| `probe-cancellations.mjs`    | Prints every cancellation observed feed-wide for N seconds. Diagnostic.  |
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
- ~~**CRS / human-name resolution**~~ — **done.** `locations-loader.mjs` loads 12 k locations + 43 TOCs from `ref_v*.xml.gz`. The daemon snapshot now includes `stationName`, `originName`/`originCrs`, `destinationName`/`destinationCrs`, `callingAfterNames[]`/`callingAfterCrs[]`, and `tocName` (e.g. `"Northern"`, `"TransPennine Express"`).

> **Note on ref file versions**: reference files have their own version scheme
> (`_ref_v1` / `_ref_v2` / `_ref_v3` / `_ref_v4` / `_ref_v99`) that is
> **unrelated** to the timetable file's v5/v6/v7/v8. As of 2026-04-28 `ref_v4`
> is the current production version. No `ref_v8` exists.
- ~~**Continuous JSON output**~~ — **done.** See `departures-daemon.mjs` — writes `state/<tiploc>-departures.json` atomically every N seconds.

