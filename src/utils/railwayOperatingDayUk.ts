/**
 * UK **operating day** boundary used by the Darwin daemon and departures UI.
 * Labelled day runs **02:00 → 01:59** the next calendar morning (Europe/London).
 * Must stay aligned with `railwayDayYmd` / `UK_RAILWAY_DAY_START_MINUTES` in
 * `darwin-local-test/departures-daemon.mjs`.
 */
export const UK_RAILWAY_DAY_START_MINUTES = 2 * 60

/**
 * Operating-day YYYY-MM-DD from London wall-clock components (same pseudo-UTC
 * composition as the daemon’s `railwayDayYmd`).
 */
export function railwayOperatingDayIsoFromLondonParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const londonAsUtcMs = Date.UTC(year, month - 1, day, hour, minute)
  const railwayDayUtcMs = londonAsUtcMs - UK_RAILWAY_DAY_START_MINUTES * 60 * 1000
  return new Date(railwayDayUtcMs).toISOString().slice(0, 10)
}
