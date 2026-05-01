# Darwin VM — Cloud Monitoring alerts (Phase 5)

These artefacts mirror the runbook requirements:

| Alert | Metric / signal | Threshold |
|-------|----------------|-----------|
| Disk high | Ops Agent `agent.googleapis.com/disk/percent_used` on `/` | **> 80%** (warn), **> 90%** (critical) |
| Daemon restarts | Cloud Logging log-based metric — count `Started darwin-daemon.service` in `journalctl` forwarded logs | **> 0** in 60 minutes |
| Public API latency | Existing **Uptime check** on `https://api-darwin.railstatistics.co.uk/api/health` (401 expected is OK for synthetic check — configure check to accept 401 or use a dedicated `/api/ping` later) | **p95 > 2s** |

## Prerequisites

1. **Ops Agent** must be running on `darwin-vm` so `agent.googleapis.com/disk/percent_used` exists.
2. A **notification channel** (email, Slack webhook, PagerDuty, etc.) in Cloud Monitoring.
3. Replace placeholders in the JSON files:
   - `PROJECT_ID` → `rail-statistics`
   - `INSTANCE_ID` → numeric ID of `darwin-vm` (Console → Compute Engine → VM instances → ID column)
   - `ZONE` → `europe-west2-b`
   - `NOTIFICATION_CHANNEL_RESOURCE_NAME` → full name like `projects/rail-statistics/notificationChannels/1234567890`

### Find instance ID

```bash
gcloud compute instances describe darwin-vm \
  --zone=europe-west2-b --project=rail-statistics \
  --format='value(id)'
```

### Create notification channel (Console)

Monitoring → Alerting → Edit notification channels → Add new.

---

## Option A — Push policies via API (non-interactive)

Set env vars, then run:

```bash
export PROJECT_ID=rail-statistics
export ACCESS_TOKEN="$(gcloud auth print-access-token)"
export CHANNEL='projects/rail-statistics/notificationChannels/YOUR_CHANNEL_ID'
./deploy/darwin-vm/monitoring/push-alert-policies.sh
```

The script POSTs each JSON file to `monitoring.googleapis.com/v3/projects/$PROJECT_ID/alertPolicies`.

---

## Option B — Console (click-through)

1. **Disk > 80% / > 90%**  
   Monitoring → Alerting → Create policy → Metric: **VM Instance — Disk utilization** (Ops Agent) → Filter instance `darwin-vm` → Condition threshold 80 (duplicate policy for 90).

2. **Daemon restarts**  
   Logging → Logs explorer → Query:

   ```
   resource.type="gce_instance"
   jsonPayload._SYSTEMD_UNIT="darwin-daemon.service"
   OR textPayload:"Started darwin-daemon.service"
   ```

   Create **log-based metric** (counter), then alerting policy **rate > 0** in 1h (tune query to match how Ops Agent ships journal entries).

3. **Uptime latency p95 > 2s**  
   Monitoring → Uptime checks → select check for `api-darwin.railstatistics.co.uk` → Alerting → Latency p95 > 2000 ms.

---

## Graceful shutdown note

If `systemctl restart darwin-daemon` hits **SIGKILL** after timeout (large `JSON.stringify` on persist), increase stop timeout in the unit file:

```ini
TimeoutStopSec=180
```

Then `sudo systemctl daemon-reload`.
