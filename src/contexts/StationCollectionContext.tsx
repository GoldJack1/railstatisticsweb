import React, { createContext, useContext, useCallback, useState, useEffect } from 'react'
import type { StationCollectionId } from '../services/firebase'
import { getStationCollectionName, setStationCollectionName } from '../services/firebase'

interface StationCollectionContextValue {
  collectionId: StationCollectionId
  setCollectionId: (id: StationCollectionId) => void
}

const StationCollectionContext = createContext<StationCollectionContextValue | null>(null)

export const StationCollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collectionId, setCollectionIdState] = useState<StationCollectionId>(() => getStationCollectionName())

  // Keep localStorage in sync if the initial value changes (e.g. between server/client)
  useEffect(() => {
    setStationCollectionName(collectionId)
  }, [collectionId])

  const setCollectionId = useCallback((id: StationCollectionId) => {
    setCollectionIdState(id)
    setStationCollectionName(id)
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
