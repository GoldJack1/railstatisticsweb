import { useEffect, useMemo, useState } from 'react'
import { fetchStationsFromFirebase } from '../services/firebase'
import type { StationCollectionId } from '../constants/stationCollections'
import { DEFAULT_NETWORK_COLLECTION_ID } from '../constants/stationCollections'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import { resolvePendingTargetCollectionId } from '../utils/pendingChangesByCollection'

export function useNextStationId(targetCollectionId: StationCollectionId): {
  nextStationId: string
  loading: boolean
} {
  const { pendingChanges } = usePendingStationChanges()
  const [stationIds, setStationIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchStationsFromFirebase(targetCollectionId)
      .then((stations) => {
        if (!cancelled) {
          setStationIds(stations.map((s) => s.id))
        }
      })
      .catch(() => {
        if (!cancelled) setStationIds([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [targetCollectionId])

  const nextStationId = useMemo(() => {
    const numericIds: number[] = []
    const idLengths: number[] = []

    for (const id of stationIds) {
      if (/^\d+$/.test(id)) {
        numericIds.push(parseInt(id, 10))
        idLengths.push(id.length)
      }
    }

    for (const [id, entry] of Object.entries(pendingChanges)) {
      if (!entry.isNew) continue
      const target = resolvePendingTargetCollectionId(entry, DEFAULT_NETWORK_COLLECTION_ID)
      if (target !== targetCollectionId) continue
      if (/^\d+$/.test(id)) {
        numericIds.push(parseInt(id, 10))
        idLengths.push(id.length)
      }
    }

    if (numericIds.length === 0) {
      return '0001'
    }

    const maxNumericId = Math.max(...numericIds)
    const next = maxNumericId + 1
    const maxLength = Math.max(4, ...idLengths)
    return String(next).padStart(maxLength, '0')
  }, [stationIds, pendingChanges, targetCollectionId])

  return { nextStationId, loading }
}
