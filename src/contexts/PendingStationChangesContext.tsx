/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { SandboxStationDoc, Station } from '../types'
import {
  readServerScheduledJobId,
  writeServerScheduledJobId,
  readScheduleSavedFingerprint,
  writeScheduleSavedFingerprint
} from '../utils/scheduledPublishStorage'
import { computePendingChangesFingerprint } from '../utils/pendingChangesFingerprint'
import {
  pendingEntryMatchesScheduledPayload,
  type ScheduledJobStationPayload
} from '../utils/scheduledJobPendingMatch'
import ScheduledServerJobFirestoreSync, { type ServerScheduledJobDetail } from './ScheduledServerJobFirestoreSync'

const PENDING_CHANGES_STORAGE_KEY = 'railstatistics-pending-station-changes-v1'

function loadPendingChangesFromStorage(): Record<string, PendingChangeEntry> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PENDING_CHANGES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, PendingChangeEntry>
  } catch {
    return {}
  }
}

export interface PendingChangeEntry {
  original: Station
  updated: Partial<Station>
  /** Optional sandbox-only extra fields (for newsandboxstations1). */
  sandboxUpdated?: Partial<SandboxStationDoc> | null
  isNew?: boolean
}

interface PendingStationChangesContextValue {
  pendingChanges: Record<string, PendingChangeEntry>
  upsertPendingChange: (station: Station, updated: Partial<Station>, sandboxUpdated?: Partial<SandboxStationDoc> | null) => void
  addNewPendingStation: (stationId: string, updated: Partial<Station>, sandboxUpdated?: Partial<SandboxStationDoc> | null) => void
  clearPendingChange: (stationId: string) => void
  clearAllPendingChanges: () => void
  clearPendingChangesForIds: (stationIds: string[]) => void
  /** Firestore scheduled publish job id (persisted in localStorage). */
  trackedScheduledJobId: string | null
  registerScheduledServerJob: (jobId: string) => void
  clearTrackedScheduledServerJob: () => void
  /** Latest snapshot summary for UI (pending / processing / failed). Cleared when job completes or is cancelled. */
  serverScheduledJobDetail: ServerScheduledJobDetail | null
}

const PendingStationChangesContext = createContext<PendingStationChangesContextValue | null>(null)

export const PendingStationChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChangeEntry>>(loadPendingChangesFromStorage)
  const [trackedScheduledJobId, setTrackedScheduledJobId] = useState<string | null>(() => readServerScheduledJobId())
  const [serverScheduledJobDetail, setServerScheduledJobDetail] = useState<ServerScheduledJobDetail | null>(null)
  /** Avoid re-baselining the same job id when fingerprint was missing (legacy). */
  const scheduleFingerprintBaselinedForJobRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(PENDING_CHANGES_STORAGE_KEY, JSON.stringify(pendingChanges))
    } catch {
      /* quota / private mode */
    }
  }, [pendingChanges])

  const upsertPendingChange = useCallback((
    station: Station,
    updated: Partial<Station>,
    sandboxUpdated?: Partial<SandboxStationDoc> | null
  ) => {
    setPendingChanges(prev => ({
      ...prev,
      [station.id]: {
        original: station,
        updated,
        sandboxUpdated: sandboxUpdated ?? prev[station.id]?.sandboxUpdated ?? null,
        isNew: prev[station.id]?.isNew
      }
    }))
  }, [])

  const addNewPendingStation = useCallback((
    stationId: string,
    updated: Partial<Station>,
    sandboxUpdated?: Partial<SandboxStationDoc> | null
  ) => {
    const original: Station = {
      id: stationId,
      stationName: updated.stationName ?? '',
      crsCode: updated.crsCode ?? '',
      tiploc: updated.tiploc ?? null,
      latitude: typeof updated.latitude === 'number' ? updated.latitude : 0,
      longitude: typeof updated.longitude === 'number' ? updated.longitude : 0,
      country: updated.country ?? null,
      county: updated.county ?? null,
      toc: updated.toc ?? null,
      stnarea: updated.stnarea ?? null,
      londonBorough: updated.londonBorough ?? null,
      fareZone: updated.fareZone ?? null,
      yearlyPassengers: (updated.yearlyPassengers ?? null) as Station['yearlyPassengers']
    }

    setPendingChanges(prev => ({
      ...prev,
      [stationId]: {
        original,
        updated,
        sandboxUpdated: sandboxUpdated ?? prev[stationId]?.sandboxUpdated ?? null,
        isNew: true
      }
    }))
  }, [])

  const clearPendingChange = useCallback((stationId: string) => {
    setPendingChanges(prev => {
      const next = { ...prev }
      delete next[stationId]
      return next
    })
  }, [])

  const clearAllPendingChanges = useCallback(() => {
    setPendingChanges({})
  }, [])

  const clearPendingChangesForIds = useCallback((stationIds: string[]) => {
    if (stationIds.length === 0) return
    setPendingChanges(prev => {
      const next = { ...prev }
      for (const id of stationIds) {
        delete next[id]
      }
      return next
    })
  }, [])

  const clearTrackedScheduledServerJob = useCallback(() => {
    writeServerScheduledJobId(null)
    writeScheduleSavedFingerprint(null)
    scheduleFingerprintBaselinedForJobRef.current = null
    setTrackedScheduledJobId(null)
    setServerScheduledJobDetail(null)
  }, [])

  const registerScheduledServerJob = useCallback((jobId: string) => {
    writeServerScheduledJobId(jobId)
    setTrackedScheduledJobId(jobId)
  }, [])

  /**
   * Legacy: job id in storage but no fingerprint — baseline once from current pending.
   * New: fingerprint is written when the user saves a schedule (for UI drift hints vs current queue).
   */
  useEffect(() => {
    if (!trackedScheduledJobId) {
      scheduleFingerprintBaselinedForJobRef.current = null
      return
    }
    if (readScheduleSavedFingerprint() !== null) {
      scheduleFingerprintBaselinedForJobRef.current = trackedScheduledJobId
      return
    }
    if (scheduleFingerprintBaselinedForJobRef.current === trackedScheduledJobId) return
    writeScheduleSavedFingerprint(computePendingChangesFingerprint(pendingChanges))
    scheduleFingerprintBaselinedForJobRef.current = trackedScheduledJobId
  }, [trackedScheduledJobId, pendingChanges])

  const handleServerJobDetail = useCallback((detail: ServerScheduledJobDetail | null) => {
    setServerScheduledJobDetail(detail)
  }, [])

  const handleServerJobCompleted = useCallback(
    (stationIds: string[], scheduledChanges: Record<string, ScheduledJobStationPayload> | null) => {
      setPendingChanges(prev => {
        const next = { ...prev }
        for (const id of stationIds) {
          const entry = next[id]
          if (!entry) continue
          if (scheduledChanges == null) {
            delete next[id]
            continue
          }
          const sch = scheduledChanges[id]
          if (sch == null) {
            delete next[id]
            continue
          }
          if (pendingEntryMatchesScheduledPayload(entry, sch)) {
            delete next[id]
          }
        }
        return next
      })
      clearTrackedScheduledServerJob()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('railstats-stations-refetch'))
      }
    },
    [clearTrackedScheduledServerJob]
  )

  return (
    <PendingStationChangesContext.Provider
      value={{
        pendingChanges,
        upsertPendingChange,
        addNewPendingStation,
        clearPendingChange,
        clearAllPendingChanges,
        clearPendingChangesForIds,
        trackedScheduledJobId,
        registerScheduledServerJob,
        clearTrackedScheduledServerJob,
        serverScheduledJobDetail
      }}
    >
      <ScheduledServerJobFirestoreSync
        jobId={trackedScheduledJobId}
        onDetail={handleServerJobDetail}
        onCompleted={handleServerJobCompleted}
        onJobDocMissing={clearTrackedScheduledServerJob}
      />
      {children}
    </PendingStationChangesContext.Provider>
  )
}

export const usePendingStationChanges = (): PendingStationChangesContextValue => {
  const ctx = useContext(PendingStationChangesContext)
  if (!ctx) {
    throw new Error('usePendingStationChanges must be used within PendingStationChangesProvider')
  }
  return ctx
}
