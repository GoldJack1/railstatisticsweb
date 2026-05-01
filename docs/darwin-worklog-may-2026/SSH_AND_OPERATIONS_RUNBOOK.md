# SSH and Operations Runbook (Darwin VM)

## Prerequisites

- `gcloud` installed and authenticated
- Correct project selected:

```bash
gcloud config set project rail-statistics
```

- VM access permissions

## SSH into VM

```bash
gcloud compute ssh darwin-vm --zone europe-west2-b
```

## Basic service status

```bash
systemctl is-active darwin-daemon
systemctl --no-pager --lines=20 status darwin-daemon
systemctl show darwin-daemon -p MainPID -p MemoryCurrent -p ActiveEnterTimestamp
```

## Logs

```bash
journalctl -u darwin-daemon -n 200 --no-pager
journalctl -u darwin-daemon --since "30 minutes ago" --no-pager
```

## Restart daemon

```bash
sudo systemctl restart darwin-daemon
sudo systemctl status darwin-daemon --no-pager --lines=30
```

## Health endpoint check (with API key)

Read first key from environment and call health endpoint:

```bash
KEY="$(python3 - <<'PY'
from pathlib import Path
import re
text = Path('/etc/darwin-daemon.env').read_text()
m = re.search(r'^INTERNAL_API_KEYS=(.*)$', text, re.M)
print(m.group(1).split(',')[0].strip() if m and m.group(1).strip() else '')
PY
)"

curl -sS -H "X-API-Key: $KEY" http://127.0.0.1:4001/api/health | python3 -m json.tool
```

## Quick resource checks

```bash
free -h
df -h
ps -o pid,%mem,%cpu,cmd -p "$(systemctl show -p MainPID --value darwin-daemon)"
```

## Known gotchas

- `401 unauthorized` on health endpoint usually means key missing/invalid.
- If behavior seems stalled, inspect logs before restart.
- If memory keeps climbing near cap, review cache/history settings and recent state changes.
