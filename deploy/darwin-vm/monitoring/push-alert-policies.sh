#!/usr/bin/env bash
# Push Monitoring alert policies from JSON files (Monitoring API v3).
#
# Usage:
#   export PROJECT_ID=rail-statistics
#   export INSTANCE_ID="$(gcloud compute instances describe darwin-vm \
#       --zone=europe-west2-b --project=rail-statistics --format='value(id)')"
#   export NOTIFICATION_CHANNEL='projects/rail-statistics/notificationChannels/XXXXXXXX'
#   export ACCESS_TOKEN="$(gcloud auth print-access-token)"
#   ./push-alert-policies.sh
#
# Creates policies idempotently — duplicate displayNames may fail; delete old
# policies in Console first if re-running.

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="${PROJECT_ID:-rail-statistics}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
INSTANCE_ID="${INSTANCE_ID:-}"
CHANNEL="${NOTIFICATION_CHANNEL:-}"

if [[ -z "$ACCESS_TOKEN" ]]; then
  ACCESS_TOKEN="$(gcloud auth print-access-token --project="$PROJECT_ID")"
fi

if [[ -z "$INSTANCE_ID" ]]; then
  echo "ERROR: Set INSTANCE_ID (numeric GCE instance id) or export before running." >&2
  exit 1
fi
if [[ -z "$CHANNEL" || "$CHANNEL" == *REPLACE* ]]; then
  echo "ERROR: Set NOTIFICATION_CHANNEL to projects/$PROJECT_ID/notificationChannels/..." >&2
  exit 1
fi

API="https://monitoring.googleapis.com/v3/projects/$PROJECT_ID/alertPolicies"

for f in disk-percent-used-80.json disk-percent-used-90.json; do
  path="$SCRIPT_DIR/$f"
  [[ -f "$path" ]] || { echo "missing $path"; exit 1; }
  body="$(sed \
    -e "s/REPLACE_INSTANCE_ID/$INSTANCE_ID/g" \
    -e "s|REPLACE_NOTIFICATION_CHANNEL|$CHANNEL|g" \
    "$path")"
  echo "Creating policy from $f ..."
  curl -fsS -X POST "$API" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$body" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  OK:", d.get("displayName"), "name=", d.get("name"))'
done

echo
echo "NOTE: Uptime-check latency (p95 > 2s) and systemd restart alerts must be"
echo "      configured in Console — see monitoring/README.md (log-based metric)."
