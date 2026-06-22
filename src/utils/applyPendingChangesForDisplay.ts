import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { SandboxStationDoc, Station } from '../types'
import { getFieldChangesForPendingReview, type StationFieldChange } from './stationFieldDiffs'

import type { NetworkViewFilter } from '../constants/stationCollections'
import { resolvePendingTargetCollectionId } from './pendingChangesByCollection'
import { mergePendingNewStationsForMap } from './pendingMapStations'
import { getStationNetworkCollectionId } from './stationAreaSlug'

export function mergeStationWithPendingUpdate(station: Station, entry: PendingChangeEntry | undefined): Station {
  if (!entry || entry.isNew) return station
  return { ...station, ...entry.updated }
}

export function findPendingEntryForStation(
  station: Station,
  pendingChanges: Record<string, PendingChangeEntry>
): PendingChangeEntry | undefined {
  const entry = pendingChanges[station.id]
  if (!entry || entry.isNew) return undefined

  const stationCollection = getStationNetworkCollectionId(station)
  const entryCollection = resolvePendingTargetCollectionId(entry)

  if (stationCollection && entryCollection !== stationCollection) {
    return undefined
  }

  return entry
}

export function mergePendingChangesForStationsList(
  firestoreStations: Station[],
  pendingChanges: Record<string, PendingChangeEntry>,
  networkView: NetworkViewFilter
): Station[] {
  const withUpdates = firestoreStations.map((station) =>
    mergeStationWithPendingUpdate(station, findPendingEntryForStation(station, pendingChanges))
  )

  return mergePendingNewStationsForMap(withUpdates, pendingChanges, networkView).stations
}

export function mergeAdditionalDocWithPendingUpdate(
  doc: SandboxStationDoc | null,
  entry: PendingChangeEntry | undefined
): SandboxStationDoc | null {
  if (!entry?.sandboxUpdated) return doc
  if (!doc) return entry.sandboxUpdated as SandboxStationDoc
  return { ...doc, ...entry.sandboxUpdated }
}

export function getPendingFieldChangesForEntry(
  entry: PendingChangeEntry | undefined,
  options?: { additionalDocFallback?: SandboxStationDoc | null }
): StationFieldChange[] {
  if (!entry) return []
  return getFieldChangesForPendingReview(entry, options)
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
