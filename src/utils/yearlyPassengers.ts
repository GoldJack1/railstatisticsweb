import type { Station, YearlyPassengers } from '../types'

export function parseYearlyPassengerCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '')
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function extractYearlyPassengersFromFirestoreData(
  data: Record<string, unknown>
): YearlyPassengers | null {
  const nested = data.yearlyPassengers
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const result: YearlyPassengers = {}
    let hasValue = false

    for (const [year, value] of Object.entries(nested as Record<string, unknown>)) {
      if (!/^\d{4}$/.test(year)) continue
      const count = parseYearlyPassengerCount(value)
      if (count != null) {
        result[year] = count
        hasValue = true
      } else if (value === null) {
        result[year] = null
      }
    }

    if (hasValue) return result
  }

  const fromTopLevel: YearlyPassengers = {}
  let hasTopLevel = false

  for (const [key, value] of Object.entries(data)) {
    if (!/^\d{4}$/.test(key)) continue
    const count = parseYearlyPassengerCount(value)
    if (count != null) {
      fromTopLevel[key] = count
      hasTopLevel = true
    } else if (value === null) {
      fromTopLevel[key] = null
    }
  }

  return hasTopLevel ? fromTopLevel : null
}

export function getLatestYearlyPassengerEntry(
  passengers: Station['yearlyPassengers'] | YearlyPassengers | number | string | null | undefined
): { year: string; count: number } | null {
  if (passengers == null) return null

  if (typeof passengers === 'number' || typeof passengers === 'string') {
    const count = parseYearlyPassengerCount(passengers)
    return count != null ? { year: '', count } : null
  }

  if (typeof passengers !== 'object' || Array.isArray(passengers)) return null

  return (
    Object.keys(passengers)
      .filter((year) => /^\d{4}$/.test(year))
      .map((year) => ({
        year,
        count: parseYearlyPassengerCount(passengers[year]),
      }))
      .filter((entry): entry is { year: string; count: number } => entry.count != null)
      .sort((a, b) => parseInt(b.year, 10) - parseInt(a.year, 10))[0] ?? null
  )
}

export function getLatestYearlyPassengerCount(
  passengers: Station['yearlyPassengers'] | YearlyPassengers | number | string | null | undefined
): number | null {
  return getLatestYearlyPassengerEntry(passengers)?.count ?? null
}

export function getLatestYearlyPassengerDisplay(
  passengers: Station['yearlyPassengers'] | YearlyPassengers | number | string | null | undefined
): string {
  const entry = getLatestYearlyPassengerEntry(passengers)
  if (!entry) return ''

  const formattedCount = entry.count.toLocaleString()
  return entry.year ? `(${entry.year}) ${formattedCount}` : formattedCount
}
