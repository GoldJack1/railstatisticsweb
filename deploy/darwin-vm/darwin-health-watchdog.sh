#!/usr/bin/env bash
# Logs Kafka/PTAC staleness via /api/health (optional API key from env file).
# Does not restart darwin-daemon — restarts are left to systemd/operators so
# flushes are not interrupted unexpectedly.
set -euo pipefail

STATE_FILE="/tmp/darwin-health-watchdog.failcount"
ENV_FILE="/etc/darwin-daemon.env"
FAILS=0
if [[ -f "$STATE_FILE" ]]; then
  FAILS=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
fi

API_KEY=""
if [[ -f "$ENV_FILE" ]]; then
  # Prefer multi-key list, first key used for local health checks.
  KEYS_LINE="$(awk -F= '/^INTERNAL_API_KEYS=/{print $2}' "$ENV_FILE" | tail -n1 || true)"
  if [[ -n "$KEYS_LINE" ]]; then
    API_KEY="$(printf "%s" "$KEYS_LINE" | awk -F',' '{print $1}' | sed 's/^ *//;s/ *$//')"
  else
    API_KEY="$(awk -F= '/^INTERNAL_API_KEY=/{print $2}' "$ENV_FILE" | tail -n1 | sed 's/^ *//;s/ *$//' || true)"
  fi
fi

if [[ -n "$API_KEY" ]]; then
  HEALTH_JSON="$(curl -fsS --max-time 8 -H "X-API-Key: $API_KEY" http://127.0.0.1:4001/api/health || true)"
else
  HEALTH_JSON="$(curl -fsS --max-time 8 http://127.0.0.1:4001/api/health || true)"
fi
if [[ -z "$HEALTH_JSON" ]]; then
  FAILS=$((FAILS + 1))
  echo "$FAILS" > "$STATE_FILE"
  logger -t darwin-watchdog "health endpoint failed ($FAILS)"
else
  STALE_RESULT="$(
    printf "%s" "$HEALTH_JSON" | python3 -c '
import json
import sys
from datetime import datetime, timezone

raw = sys.stdin.read().strip()
if not raw:
    print("bad_json")
    raise SystemExit(0)
try:
    h = json.loads(raw)
except Exception:
    print("bad_json")
    raise SystemExit(0)

now = datetime.now(timezone.utc)

def age_sec(ts):
    if not ts:
        return 10**9
    try:
        return (now - datetime.fromisoformat(ts.replace("Z", "+00:00"))).total_seconds()
    except Exception:
        return 10**9

k_age = age_sec((h.get("kafka") or {}).get("lastKafkaMsgAt"))
p_age = age_sec((h.get("ptac") or {}).get("lastMessageAt"))

k_stale = k_age > 300   # 5 min
p_stale = p_age > 900   # 15 min

if k_stale and p_stale:
    print(f"stale both kafka={int(k_age)}s ptac={int(p_age)}s")
else:
    print(f"ok kafka={int(k_age)}s ptac={int(p_age)}s")
'
  )"

  if [[ "$STALE_RESULT" == ok* ]]; then
    echo 0 > "$STATE_FILE"
    exit 0
  fi

  FAILS=$((FAILS + 1))
  echo "$FAILS" > "$STATE_FILE"
  logger -t darwin-watchdog "$STALE_RESULT (failure $FAILS)"
fi
