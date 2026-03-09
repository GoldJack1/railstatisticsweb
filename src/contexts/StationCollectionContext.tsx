import React, { createContext, useContext, useCallback } from 'react'
import type { StationCollectionId } from '../services/firebase'

interface StationCollectionContextValue {
  collectionId: StationCollectionId
  setCollectionId: (id: StationCollectionId) => void
}

const StationCollectionContext = createContext<StationCollectionContextValue | null>(null)

const PRODUCTION_COLLECTION: StationCollectionId = 'stations2603'

export const StationCollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const collectionId = PRODUCTION_COLLECTION
  const setCollectionId = useCallback((_id: StationCollectionId) => {
    // No-op: website always uses production; collection cannot be changed.
  }, [])

  return (
    <StationCollectionContext.Provider value={{ collectionId, setCollectionId }}>
      {children}
    </StationCollectionContext.Provider>
  )
}

export const useStationCollection = (): StationCollectionContextValue => {
  const ctx = useContext(StationCollectionContext)
  if (!ctx) {
    throw new Error('useStationCollection must be used within StationCollectionProvider')
  }
  return ctx
}
