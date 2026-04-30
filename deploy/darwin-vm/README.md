# Darwin VM Deploy (Phase 1)

This folder contains additive deployment artifacts for running Darwin on a GCP VM.

Scope:
- Project: `rail-statistics`
- VM shape: `e2-micro`
- Region: `europe-west2`
- Domain: `api-darwin.railstatistics.co.uk`
- Service account: `darwin-vm-sa@rail-statistics.iam.gserviceaccount.com`

Important:
- This setup does not modify `darwin-local-test/` source files.
- The daemon still runs from `darwin-local-test/departures-daemon.mjs`.

## Files in this folder

- `env.example` - Environment template for `/etc/darwin-daemon.env`
- `darwin-daemon.service` - systemd unit
- `darwin-fetch.cron` - daily fetch cron
- `Caddyfile` - TLS reverse proxy to local daemon port
- `setup.sh` - initial VM bootstrap
- `update.sh` - pull latest repo and restart service
- `backup-state.sh` - backup state directory to GCS

## Phase 2/3 run order (on VM)

1. Copy repo to VM.
2. Copy `env.example` to `/etc/darwin-daemon.env` and fill secrets.
3. Run `setup.sh` as root.
4. Verify:
   - `systemctl status darwin-daemon`
   - `curl http://127.0.0.1:4001/api/health`
5. Add DNS A record in Netlify:
   - Name: `api-darwin`
   - Value: VM static IP
   - TTL: `300`
6. Verify TLS:
   - `curl https://api-darwin.railstatistics.co.uk/api/health`

## Netlify rewrite (later phase)

Add a rewrite rule:

`/api/darwin/*  https://api-darwin.railstatistics.co.uk/api/:splat  200`

## Operational commands

- Restart daemon:
  - `sudo systemctl restart darwin-daemon`
- Tail daemon logs:
  - `sudo journalctl -u darwin-daemon -f`
- Run manual fetch:
  - `cd /opt/railstats && npm --prefix darwin-local-test run fetch:daily-files`
- Run backup:
  - `sudo /opt/railstats/deploy/darwin-vm/backup-state.sh`

## Recommended cache durability settings

In `/etc/darwin-daemon.env`:

- `KEEP_STATE_ACROSS_DAYS=true`
- `PROTECT_RICHER_STATE=true`
- `STATE_SNAPSHOT_COUNT=24`

This keeps Darwin/PTAC persisted cache across day rollovers, prevents obvious
downgrades from overwriting richer state, and keeps rolling state snapshots for
quick recovery.

## Historical + unit cache files

The daemon now writes:

- `darwin-local-test/state/history/YYYY-MM-DD/daemon-cache.latest.json`
  - latest persisted state snapshot for that operating day (used by `?date=` lookups)
- `darwin-local-test/state/unit-catalog.json`
  - cumulative unit catalogue across days (additive/merge behavior)

API additions:

- `GET /api/service/:rid?date=YYYY-MM-DD`
- `GET /api/units/catalog?fleet=158`
