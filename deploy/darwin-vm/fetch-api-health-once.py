#!/usr/bin/env python3
"""Read /etc/darwin-daemon.env and GET /api/health on localhost (for VM ops)."""
import json
import re
import sys
import urllib.request

ENV_PATH = "/etc/darwin-daemon.env"


def load_env(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
                v = v[1:-1]
            out[k] = v
    return out


def main() -> int:
    try:
        e = load_env(ENV_PATH)
    except OSError as ex:
        print(ex, file=sys.stderr)
        return 1
    port = e.get("DAEMON_PORT", "4001")
    keys = [s.strip() for s in e.get("INTERNAL_API_KEYS", "").split(",") if s.strip()]
    if not keys:
        one = e.get("INTERNAL_API_KEY", "").strip()
        if one:
            keys = [one]
    key = keys[0] if keys else ""
    url = f"http://127.0.0.1:{port}/api/health"
    req = urllib.request.Request(url)
    if key:
        req.add_header("X-API-Key", key)
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode("utf-8")
    obj = json.loads(body)
    print("--- summary ---")
    print("ok:", obj.get("ok"), "mode:", obj.get("mode"), "clientReadsAllowed:", obj.get("clientReadsAllowed"))
    print("loadedDate:", obj.get("loadedDate"), "journeysLoaded:", obj.get("journeysLoaded"), "tiplocsIndexed:", obj.get("tiplocsIndexed"))
    mem = obj.get("memoryMB") or {}
    print("memoryMB heap/rss:", mem.get("heap"), mem.get("rss"))
    h = obj.get("history") or {}
    ct = h.get("cacheTuning") or {}
    print("history.cacheTuning:", json.dumps(ct, separators=(",", ":")))
    print("--- full body ---")
    print(json.dumps(obj, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
