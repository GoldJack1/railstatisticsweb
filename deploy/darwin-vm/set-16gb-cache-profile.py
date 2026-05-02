#!/usr/bin/env python3
"""Apply historical-cache env tuned for ~16GB RAM (see env.example). Run on the VM: sudo python3 set-16gb-cache-profile.py"""
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
    'DEPARTURES_HIST_CACHE_MS': '300000',
    'HIST_TIMETABLE_CACHE_TTL_MS': '604800000',
    'HIST_TIMETABLE_CACHE_MAX': '24',
    'HIST_CONTEXT_CACHE_TTL_MS': '86400000',
    'HIST_CONTEXT_CACHE_MAX': '128',
    'HIST_STATE_FILE_CACHE_TTL_MS': '21600000',
    'HIST_STATE_FILE_CACHE_MAX': '64',
    'HIST_SNAPSHOT_LIST_CACHE_TTL_MS': '300000',
    'WARMUP_ENABLED': 'true',
    'WARMUP_DAYS': '14',
    'WARMUP_MAX_RSS_MB': '11000',
    'WARMUP_LAG_MS': '250',
}

for k, v in updates.items():
    text = upsert(text, k, v)

p.write_text(text)
print('env updated with ~16GB historical cache profile')
