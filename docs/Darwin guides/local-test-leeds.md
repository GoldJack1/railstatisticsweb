# Darwin Local Test: Leeds Departures (Kafka)

This local-only test verifies that you can:

1. Authenticate to Darwin Kafka.
2. Consume live Push Port messages.
3. Surface departures that call at Leeds (`LDS`).

It does not touch website runtime codepaths.

## Files used

- Script: `scripts/local/darwin-leeds-test.mjs`
- Env template: `.env.darwin.local.example`

## Setup

1. Copy the template:

```bash
cp .env.darwin.local.example .env.darwin.local
```

2. Edit `.env.darwin.local` and fill in real credentials and group/topic values.

3. Ensure dependencies are installed:

```bash
npm install
```

## Run

```bash
npm run darwin:test:leeds
```

The script runs for 120 seconds by default, then exits and prints a summary.

## Optional overrides

You can change run behavior in `.env.darwin.local`:

- `DARWIN_TEST_DURATION_SEC=180` for a longer sample window.
- `DARWIN_LEEDS_CRS=LDS` to change station filter.
- `DARWIN_FROM_BEGINNING=true` to consume from earliest offset visible to the group.

## Expected success signatures

- `Connected and subscribed. Waiting for messages...`
- Increasing consumed message count.
- `[match] seq=... type=... departures=...`
- Summary with:
  - `Total messages consumed: N` (N > 0)
  - `Messages with Leeds departures: M`
  - `Unique Leeds services captured: K`

If `N > 0` and `K = 0`, connectivity is still proven; there were just no Leeds matches in that window.

## Troubleshooting

- **Auth errors (SASL/SSL):** re-check username/password and security settings.
- **Unknown topic / ACL denied:** confirm topic name and account access in Rail Data Marketplace.
- **No messages received:** verify broker/port/network egress and that feed is active.
- **No Leeds matches:** increase `DARWIN_TEST_DURATION_SEC` or test during busier periods.

## Security notes

- Keep real credentials only in `.env.darwin.local` (local file).
- Do not commit real secrets into docs or tracked files.
