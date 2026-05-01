# API Health and Performance Notes

## Runtime findings from checks

- VM `darwin-vm` reported `RUNNING` during checks.
- `darwin-daemon` service reported active/running.
- Health endpoint responded quickly locally, but returned `401` without valid key.
- Recent daemon log window queried showed no warning/error entries.

## Current limits observed

- `MemoryMax=6500M` in systemd unit config
- `NODE_OPTIONS=--max-old-space-size=5120` for Node heap

## Unit detail first-load latency notes

### Why it felt slow

- Multiple concurrent network tasks were competing at first render:
  - unit detail load
  - latest service detail fetch
  - catalog fetch
  - snapshot day enrichment

### Mitigations applied

- Added short-lived cache in `useUnitDetail`.
- Delayed/lazy latest-service fetch to tabs that require it.
- Deferred catalog fetch until after primary detail load.
- Prevented repeated snapshot prefetch attempts for same days.

### Remaining likely bottleneck

- If first-load is still slow after frontend optimizations, backend endpoint performance for `/api/darwin/unit/:id` should be profiled next.

## Suggested next backend optimization

- Add a lightweight single-unit metadata endpoint (instead of full catalog pull) for future-day/mileage enrichment.
