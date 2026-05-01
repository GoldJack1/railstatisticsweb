#!/usr/bin/env python3
import os, re, gzip, shutil
from pathlib import Path

base = Path('/opt/railstats/darwin-local-test/state/raw-feed')
if not base.exists():
    print('raw-feed directory missing')
    raise SystemExit(0)

def dir_size(path: Path) -> int:
    total = 0
    for root, _, files in os.walk(path):
        for name in files:
            fp = Path(root) / name
            try:
                total += fp.stat().st_size
            except OSError:
                pass
    return total

before = dir_size(base)
converted = 0
removed_plain = 0
removed_when_gz_exists = 0
errors = 0

for day in sorted([d for d in base.iterdir() if d.is_dir() and re.fullmatch(r"\d{8}", d.name)]):
    for fp in sorted(day.glob('*.ndjson')):
        gz = Path(str(fp) + '.gz')
        try:
            if gz.exists():
                fp.unlink()
                removed_plain += 1
                removed_when_gz_exists += 1
                continue
            with open(fp, 'rb') as src, gzip.open(gz, 'wb', compresslevel=6) as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
            fp.unlink()
            converted += 1
            removed_plain += 1
        except Exception as e:
            errors += 1
            print(f'error {fp}: {e}')

after = dir_size(base)
latest_days = sorted([d for d in base.iterdir() if d.is_dir() and re.fullmatch(r"\d{8}", d.name)])
if latest_days:
    latest = latest_days[-1]
    plain = sum(1 for _ in latest.glob('*.ndjson'))
    gz = sum(1 for _ in latest.glob('*.ndjson.gz'))
    latest_line = f'latest_day={latest.name} plain={plain} gz={gz}'
else:
    latest_line = 'latest_day=none plain=0 gz=0'

print(f'converted_plain_to_gz={converted}')
print(f'removed_plain_when_gz_exists={removed_when_gz_exists}')
print(f'removed_plain_total={removed_plain}')
print(f'errors={errors}')
print(f'size_before_gb={before / 1024 / 1024 / 1024:.2f}')
print(f'size_after_gb={after / 1024 / 1024 / 1024:.2f}')
print(f'saved_gb={(before - after) / 1024 / 1024 / 1024:.2f}')
print(latest_line)
