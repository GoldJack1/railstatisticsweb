/**
 * Format yearlyPassengers for pending-change review (avoid raw JSON blobs).
 */
export function formatYearlyPassengersForReview(data: unknown): string {
  if (data === null || data === undefined) return '—'
  if (typeof data !== 'object' || Array.isArray(data)) {
    return String(data)
  }

  const obj = data as Record<string, unknown>
  const yearKeys = Object.keys(obj)
    .filter((k) => /^\d{4}$/.test(k))
    .sort()

  if (yearKeys.length === 0) {
    return Object.keys(obj).length === 0 ? '—' : '(unrecognised shape)'
  }

  const parts: string[] = []
  for (const y of yearKeys) {
    const v = obj[y]
    if (typeof v === 'number' && !Number.isNaN(v)) {
      parts.push(`${y}: ${v.toLocaleString()}`)
    } else if (v !== null && v !== undefined && v !== '') {
      parts.push(`${y}: ${String(v)}`)
    }
  }

  if (parts.length > 0) {
    return parts.join('; ')
  }

  const first = yearKeys[0]
  const last = yearKeys[yearKeys.length - 1]
  return first === last
    ? `${first}: (empty)`
    : `${first}–${last}: all years empty`
}
