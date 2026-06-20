import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { SandboxStationDoc, Station } from '../types'
import { getFieldChangesForPendingReview, type StationFieldChange } from './stationFieldDiffs'

export function mergeStationWithPendingUpdate(station: Station, entry: PendingChangeEntry | undefined): Station {
  if (!entry || entry.isNew) return station
  return { ...station, ...entry.updated }
}

export function mergeAdditionalDocWithPendingUpdate(
  doc: SandboxStationDoc | null,
  entry: PendingChangeEntry | undefined
): SandboxStationDoc | null {
  if (!entry?.sandboxUpdated) return doc
  if (!doc) return entry.sandboxUpdated as SandboxStationDoc
  return { ...doc, ...entry.sandboxUpdated }
}

export function getPendingFieldChangesForEntry(entry: PendingChangeEntry | undefined): StationFieldChange[] {
  if (!entry) return []
  return getFieldChangesForPendingReview(entry)
}

export function findPendingFieldChange(
  displayLabel: string,
  changes: StationFieldChange[]
): StationFieldChange | undefined {
  const norm = displayLabel.trim().toLowerCase()
  return changes.find((change) => {
    const changeLabel = change.label.trim().toLowerCase()
    const leafLabel = changeLabel.split(' · ').pop()?.trim()
    return changeLabel === norm || changeLabel.startsWith(`${norm} ·`) || leafLabel === norm
  })
}
