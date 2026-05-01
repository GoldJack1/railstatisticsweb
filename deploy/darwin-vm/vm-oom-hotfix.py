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

text = upsert(text, 'STATE_SNAPSHOT_COUNT', '0')
text = upsert(text, 'NODE_OPTIONS', '--max-old-space-size=6144')
p.write_text(text)
print('patched /etc/darwin-daemon.env')
