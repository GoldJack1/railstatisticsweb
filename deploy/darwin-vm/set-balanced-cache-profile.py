#!/usr/bin/env python3
import re
from pathlib import Path
p = Path('/etc/darwin-daemon.env')
text = p.read_text()

def upsert(text, key, value):
    pattern = re.compile(rf'^{re.escape(key)}=.*$', re.MULTILINE)
    line = f'{key}={value}'
    if pattern.search(text):
        return pattern.sub(line, text)
    if not text.endswith('\n'):
        text += '\n'
    return text + line + '\n'

updates = {
    # Balanced profile for 8GB VM
    'HIST_TIMETABLE_CACHE_TTL_MS': '43200000',
    'HIST_TIMETABLE_CACHE_MAX': '8',
    'HIST_CONTEXT_CACHE_TTL_MS': '1200000',
    'HIST_CONTEXT_CACHE_MAX': '64',
    'HIST_STATE_FILE_CACHE_TTL_MS': '2700000',
    'HIST_STATE_FILE_CACHE_MAX': '24',
    'HIST_SNAPSHOT_LIST_CACHE_TTL_MS': '120000',
    'DEPARTURES_CACHE_MS': '3000',
    'DEPARTURES_HIST_CACHE_MS': '180000',
    'WARMUP_ENABLED': 'true',
    'WARMUP_DAYS': '7',
    'WARMUP_MAX_RSS_MB': '4200',
    'WARMUP_LAG_MS': '150',
}

for k, v in updates.items():
    text = upsert(text, k, v)

p.write_text(text)
print('env updated with balanced cache profile')
