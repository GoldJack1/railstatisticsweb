import type { ScheduledJobStationPayload } from './scheduledJobPendingMatch'

export type ParsedScheduledJobDoc = {
  stationIds: string[]
  /** Display names from `changes[id].updated.stationName` when present. */
  stationLabels: Record<string, string>
  scheduledChanges: Record<string, ScheduledJobStationPayload> | null
}

/**
 * Read station list and optional labels from a `scheduledStationPublishJobs` document.
 */
export function parseScheduledJobDocForDisplay(data: Record<string, unknown>): ParsedScheduledJobDoc {
  const raw = data.stationIds
  const stationIds = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  const ch = data.changes
  let scheduledChanges: Record<string, ScheduledJobStationPayload> | null = null
  const stationLabels: Record<string, string> = {}

  if (ch && typeof ch === 'object' && !Array.isArray(ch)) {
    scheduledChanges = ch as Record<string, ScheduledJobStationPayload>
    for (const id of stationIds) {
      const payload = scheduledChanges[id]
      const name = payload?.updated?.stationName?.trim()
      if (name) stationLabels[id] = name
    }
  }

  return { stationIds, stationLabels, scheduledChanges }
}
