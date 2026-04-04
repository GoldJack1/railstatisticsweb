import type { SandboxStationDoc, Station } from '../types'

/** Shape of `changes` on a `scheduledStationPublishJobs` document. */
export type ScheduledJobStationPayload = {
  isNew?: boolean
  updated: Partial<Station>
  sandboxUpdated?: Partial<SandboxStationDoc> | null
}

/**
 * True if local pending still matches what was written into the scheduled job (same queued publish).
 * If the user edited again after scheduling, this is false and we should not drop their local row when the job completes.
 */
export function pendingEntryMatchesScheduledPayload(
  entry: {
    isNew?: boolean
    updated: Partial<Station>
    sandboxUpdated?: Partial<SandboxStationDoc> | null
  },
  sch: ScheduledJobStationPayload
): boolean {
  return (
    Boolean(entry.isNew) === Boolean(sch.isNew) &&
    JSON.stringify(entry.updated) === JSON.stringify(sch.updated) &&
    JSON.stringify(entry.sandboxUpdated ?? null) === JSON.stringify(sch.sandboxUpdated ?? null)
  )
}
