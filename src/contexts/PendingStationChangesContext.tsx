import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Station } from '../types'

interface PendingChangeEntry {
  original: Station
  updated: Partial<Station>
  isNew?: boolean
}

interface PendingStationChangesContextValue {
  pendingChanges: Record<string, PendingChangeEntry>
  upsertPendingChange: (station: Station, updated: Partial<Station>) => void
  addNewPendingStation: (stationId: string, updated: Partial<Station>) => void
  clearPendingChange: (stationId: string) => void
  clearAllPendingChanges: () => void
}

const PendingStationChangesContext = createContext<PendingStationChangesContextValue | null>(null)

export const PendingStationChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChangeEntry>>({})

  const upsertPendingChange = useCallback((station: Station, updated: Partial<Station>) => {
    setPendingChanges(prev => ({
      ...prev,
      [station.id]: {
        original: station,
        updated,
        isNew: prev[station.id]?.isNew
      }
    }))
  }, [])

  const addNewPendingStation = useCallback((stationId: string, updated: Partial<Station>) => {
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

