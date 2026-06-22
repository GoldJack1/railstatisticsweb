import type { Station } from '../types'
import { parseStoredDateForSort } from './dateDdMmYyyy'

export type SuperTramTimelineStep = {
  cutoffMs: number
  label: string
}

export function getStationOpenedTimestamp(station: Station): number | null {
  if (!station.dateOpened?.trim()) return null
  return parseStoredDateForSort(station.dateOpened)
}

export function buildSuperTramTimelineSteps(stations: Station[]): SuperTramTimelineStep[] {
  const timestamps = new Set<number>()
  for (const station of stations) {
    const openedMs = getStationOpenedTimestamp(station)
    if (openedMs != null) timestamps.add(openedMs)
  }
  return [...timestamps]
    .sort((a, b) => a - b)
    .map((cutoffMs) => ({ cutoffMs, label: formatTimelineDate(cutoffMs) }))
}

export function formatTimelineDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function isStationVisibleAtTimelineCutoff(
  station: Station,
  cutoffMs: number | null,
  showUndatedAtMax: boolean
): boolean {
  if (cutoffMs === null) return true
  const openedMs = getStationOpenedTimestamp(station)
  if (openedMs == null) return showUndatedAtMax
  return openedMs <= cutoffMs
}

export function countStationsVisibleAtTimelineCutoff(
  stations: Station[],
  cutoffMs: number | null,
  showUndatedAtMax: boolean
): number {
  return stations.filter((station) =>
    isStationVisibleAtTimelineCutoff(station, cutoffMs, showUndatedAtMax)
  ).length
}
