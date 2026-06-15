import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { StationCollectionId } from '../constants/stationCollections'
import { DEFAULT_NETWORK_COLLECTION_ID, isStationCollectionId } from '../constants/stationCollections'

export function resolvePendingTargetCollectionId(
  entry: Partial<PendingChangeEntry> | undefined,
  fallback: StationCollectionId
): StationCollectionId {
  if (entry?.targetCollectionId && isStationCollectionId(entry.targetCollectionId)) {
    return entry.targetCollectionId
  }
  return fallback
}

export function filterPendingChangesForCollection(
  pendingChanges: Record<string, PendingChangeEntry>,
  collectionId: StationCollectionId
): Record<string, PendingChangeEntry> {
  const out: Record<string, PendingChangeEntry> = {}
  for (const [id, entry] of Object.entries(pendingChanges)) {
    const target = resolvePendingTargetCollectionId(entry, DEFAULT_NETWORK_COLLECTION_ID)
    if (target === collectionId) {
      out[id] = entry
    }
  }
  return out
}

export function countPendingChangesForCollection(
  pendingChanges: Record<string, PendingChangeEntry>,
  collectionId: StationCollectionId
): number {
  return Object.keys(filterPendingChangesForCollection(pendingChanges, collectionId)).length
}

/** Returns null if all entries share one collection; otherwise an error message. */
export function validateSingleCollectionPending(
  pendingChanges: Record<string, PendingChangeEntry>,
  stationIds: string[]
): { collectionId: StationCollectionId } | { error: string } {
  let collectionId: StationCollectionId | null = null
  for (const id of stationIds) {
    const entry = pendingChanges[id]
    if (!entry) continue
    const target = resolvePendingTargetCollectionId(entry, DEFAULT_NETWORK_COLLECTION_ID)
    if (collectionId == null) {
      collectionId = target
    } else if (collectionId !== target) {
      return {
        error: 'Selected changes target more than one database. Publish or schedule one collection at a time.',
      }
    }
  }
  if (!collectionId) {
    return { error: 'No pending changes selected.' }
  }
  return { collectionId }
}
