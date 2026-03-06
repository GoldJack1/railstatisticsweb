import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  getStationCollectionName,
  STATION_COLLECTION_STORAGE_KEY,
  type StationCollectionId
} from '../services/firebase'

interface StationCollectionContextValue {
  collectionId: StationCollectionId
  setCollectionId: (id: StationCollectionId) => void
}

const StationCollectionContext = createContext<StationCollectionContextValue | null>(null)

export const StationCollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collectionId, setCollectionIdState] = useState<StationCollectionId>(getStationCollectionName)

  const setCollectionId = useCallback((id: StationCollectionId) => {
    localStorage.setItem(STATION_COLLECTION_STORAGE_KEY, id)
    setCollectionIdState(id)
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
