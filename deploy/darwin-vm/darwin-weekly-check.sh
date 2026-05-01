#!/usr/bin/env bash
# Weekly health/storage roll-up for the Darwin VM.
#
# Logs (only — no alerts) recent storage trends, daemon stability, startup
# duration, and warmup progress. Designed to be invoked from cron and tee'd
# to /var/log/darwin-weekly-check.log so journald keeps a 30-day record.
#
# Schedule via /etc/cron.d/darwin-weekly-check:
#   30 6 * * 1 root /opt/railstats/deploy/darwin-vm/darwin-weekly-check.sh \
#     >> /var/log/darwin-weekly-check.log 2>&1

set -u

STATE_DIR="${STATE_DIR:-/opt/railstats/darwin-local-test/state}"
SERVICE="${SERVICE:-darwin-daemon}"

echo "==========  $(date -Iseconds)  =========="
echo "host: $(hostname)"
echo

echo "--- df -h / ---"
df -h / 2>/dev/null || true
echo

echo "--- du -sh state/history state/raw-feed ---"
( cd "$STATE_DIR" && du -sh history raw-feed 2>/dev/null ) || true
echo

echo "--- state/history per-day breakdown (top 10 most recent) ---"
( cd "$STATE_DIR/history" 2>/dev/null && ls -1 | sort -r | head -10 \
    | while read -r d; do
        printf '  %s  %s\n' "$d" "$(du -sh "$d" 2>/dev/null | awk '{print $1}')"
      done ) || true
echo

echo "--- $SERVICE service status ---"
systemctl is-active "$SERVICE" || true
echo "NRestarts (last 7d):"
journalctl -u "$SERVICE" --since '7 days ago' 2>/dev/null \
  | grep -c 'Started darwin-daemon.service' || true
echo "FATAL ERRORs (last 7d):"
journalctl -u "$SERVICE" --since '7 days ago' 2>/dev/null \
  | grep -c 'FATAL ERROR' || true
echo "OOM/SIGKILL exits (last 7d):"
journalctl -u "$SERVICE" --since '7 days ago' 2>/dev/null \
  | grep -cE 'killed|status=137|SIGKILL' || true
echo

echo "--- recent startup durations (last 5 starts) ---"
# Each restart logs "Started darwin-daemon.service" then later the daemon
# itself logs "[daemon] HTTP API listening". Pair them up to get a startup
# duration; tolerate missing pairs.
journalctl -u "$SERVICE" --since '7 days ago' 2>/dev/null \
  | awk '
      /Started darwin-daemon.service/ { ts=$1" "$2" "$3; have_start=1; next }
      have_start && /\[daemon\] HTTP API listening/ {
        printf("  %s -> ready @ %s %s %s\n", ts, $1, $2, $3);
        have_start=0;
      }
    ' | tail -5
echo

echo "--- warmup progress (last persisted) ---"
if [ -f "$STATE_DIR/warmup-progress.json" ]; then
  python3 - "$STATE_DIR/warmup-progress.json" <<'PY' 2>/dev/null || cat "$STATE_DIR/warmup-progress.json"
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
print(f"  mode={d.get('mode')}")
print(f"  startedAt={d.get('startedAt')}  finishedAt={d.get('finishedAt')}")
print(f"  current={d.get('current')}  done={len(d.get('done', []))} skipped={len(d.get('skipped', []))} errors={len(d.get('errors', []))}")
for e in d.get('errors', [])[:3]:
    print(f"  err: {e}")
PY
else
  echo "  (no warmup-progress.json yet)"
fi
echo

echo "--- /api/health snapshot ---"
KEY="${INTERNAL_API_KEY:-}"
if [ -z "$KEY" ] && [ -f /etc/darwin-daemon.env ]; then
  KEY=$(awk -F= '/^INTERNAL_API_KEY=/{$1=""; sub(/^=/,""); print; exit}' /etc/darwin-daemon.env)
fi
if [ -n "$KEY" ]; then
  curl -fsS -m 5 -H "X-API-Key: $KEY" http://127.0.0.1:4001/api/health \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"  mode={d.get(\"mode\")} loadedDate={d.get(\"loadedDate\")} memMB.heap={d.get(\"memoryMB\",{}).get(\"heap\")} memMB.rss={d.get(\"memoryMB\",{}).get(\"rss\")} live={d.get(\"overlaySize\",{}).get(\"live\")} formations={d.get(\"overlaySize\",{}).get(\"formations\")} units={d.get(\"overlaySize\",{}).get(\"units\")}")' \
    2>/dev/null || echo "  (could not parse /api/health)"
else
  echo "  (no INTERNAL_API_KEY set; skipping health probe)"
fi
echo
echo "==========  end  =========="
