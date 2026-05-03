# Darwin VM Deploy (Phase 1)

This folder contains additive deployment artifacts for running Darwin on a GCP VM.

Scope:
- Project: `rail-statistics`
- VM shape: **production-sized** (e.g. `e2-standard-4` or larger with a balanced/SSD boot disk). Do **not** use `e2-micro` for Darwin + Kafka consumers — tune CPU/RAM/disk for timetable load, jidx, warmup RSS, and raw archive retention.
- Region: `europe-west2`
- Domain: `api-darwin.railstatistics.co.uk`
- Service account: `darwin-vm-sa@rail-statistics.iam.gserviceaccount.com`

Important:
- This setup does not modify `darwin-local-test/` source files.
- The daemon still runs from `darwin-local-test/departures-daemon.mjs`.

## Files in this folder

- `env.example` - Environment template for `/etc/darwin-daemon.env`
- `darwin-daemon.service` - systemd unit
- `darwin-fetch.cron` - daily fetch job for `/etc/cron.d/darwin-fetch` (runs as **`railstats`**, not root)
- `darwin-health-watchdog.cron` + `darwin-health-watchdog.sh` - periodic **logging** of feed staleness (does **not** restart the daemon)
- `repair-timetable-dir-perms.sh` - one-time `chown` of `tt/` if files were created by root cron
- `Caddyfile` - TLS reverse proxy to local daemon port
- `sync-vm-config.sh` - installs systemd unit, Caddyfile, and all `cron.d` snippets from the repo (used by `setup.sh` and `update.sh`)
- `setup.sh` - initial VM bootstrap
- `update.sh` - pull latest repo, sync VM config from repo, restart service
- `backup-state.sh` - backup state directory to GCS
- `darwin-weekly-check.sh` + `darwin-weekly-check.cron` - weekly storage/daemon roll-up log (Phase 5)
- `monitoring/` - Cloud Monitoring alert policy templates + `push-alert-policies.sh` (Phase 5)

## Phase 2/3 run order (on VM)

1. Copy repo to VM.
2. Copy `env.example` to `/etc/darwin-daemon.env` and fill secrets.
3. Run `setup.sh` as root.
4. Verify:
   - `systemctl status darwin-daemon`
   - `curl http://127.0.0.1:4001/api/health`
   - `curl http://127.0.0.1:4001/api/ping` (minimal JSON **200** for uptime monitors; no API key)
5. Add DNS A record in Netlify:
   - Name: `api-darwin`
   - Value: VM static IP
   - TTL: `300`
6. Verify TLS:
   - `curl https://api-darwin.railstatistics.co.uk/api/health`
   - `curl https://api-darwin.railstatistics.co.uk/api/ping`

## Netlify rewrite (later phase)

Add a rewrite rule:

`/api/darwin/*  https://api-darwin.railstatistics.co.uk/api/:splat  200`

## Operational commands

- Deploy code + refresh systemd/Caddy/cron from repo:
  - `sudo /opt/railstats/deploy/darwin-vm/update.sh` (runs `git pull`, `npm install`, `sync-vm-config.sh`, restarts `darwin-daemon`)
- Restart daemon:
  - `sudo systemctl restart darwin-daemon`
- PTAC backfill after overnight errors (replay Kafka from **00:01 London on today’s timetable SSD** into `consistByRid`): add `PTAC_REPLAY_ANCHOR=ssd_0001` to `/etc/darwin-daemon.env`, restart the daemon, confirm `[ptac] will replay (anchor=ssd_0001 …)` in logs, then **remove** that line (or set back to `rolling`) on the next restart so normal startup stays a shorter rolling window.
- Tail daemon logs:
  - `sudo journalctl -u darwin-daemon -f`
- Health watchdog (logs only; every 5 minutes via `/etc/cron.d/darwin-health-watchdog`):
  - `sudo tail -f /var/log/darwin-health-watchdog.log`
  - `journalctl -t darwin-watchdog -n 50`
- Run manual fetch (same user as the daemon — avoids root-owned `tt/` files):
  - `sudo -u railstats -H bash -lc 'cd /opt/railstats && npm --prefix darwin-local-test run fetch:daily-files'`
- If rollover failed because old cron ran as root, fix ownership once (no download):
  - `sudo /opt/railstats/deploy/darwin-vm/repair-timetable-dir-perms.sh`
- Fetch log (after deploy): `/opt/railstats/darwin-local-test/logs/darwin-fetch.log`
- If you ever installed the same fetch line in **root’s** `crontab -e`, remove it so only `/etc/cron.d/darwin-fetch` runs (otherwise root may still overwrite permissions nightly).
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
