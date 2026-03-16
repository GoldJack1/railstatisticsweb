import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Station } from '../types'

interface PendingChangeEntry {
  original: Station
  updated: Partial<Station>
}

interface PendingStationChangesContextValue {
  pendingChanges: Record<string, PendingChangeEntry>
  upsertPendingChange: (station: Station, updated: Partial<Station>) => void
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
        updated
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
      value={{ pendingChanges, upsertPendingChange, clearPendingChange, clearAllPendingChanges }}
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

