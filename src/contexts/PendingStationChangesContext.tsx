import React, { createContext, useContext, useState, useCallback } from 'react'
import type { SandboxStationDoc, Station } from '../types'

interface PendingChangeEntry {
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
}

const PendingStationChangesContext = createContext<PendingStationChangesContextValue | null>(null)

export const PendingStationChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChangeEntry>>({})

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

  return (
    <PendingStationChangesContext.Provider
      value={{ pendingChanges, upsertPendingChange, addNewPendingStation, clearPendingChange, clearAllPendingChanges }}
    >
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

