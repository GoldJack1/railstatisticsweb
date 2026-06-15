/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react'
import type { NetworkCollectionId, NetworkViewFilter, StationCollectionId } from '../constants/stationCollections'
import { deriveCollectionId } from '../constants/stationCollections'
import {
  getStationNetworkId,
  setStationNetworkId,
  getStationNetworkView,
  setStationNetworkView,
  getStationSandboxMode,
  setStationSandboxMode,
  setStationCollectionName,
} from '../services/firebase'

interface StationCollectionContextValue {
  networkView: NetworkViewFilter
  setNetworkView: (view: NetworkViewFilter) => void
  networkId: NetworkCollectionId
  setNetworkId: (id: NetworkCollectionId) => void
  isSandbox: boolean
  setSandbox: (enabled: boolean) => void
  /** Active Firestore collection for edits (sandbox overrides; All uses last single-network). */
  collectionId: StationCollectionId
  /** @deprecated Use networkView / networkId / isSandbox */
  setCollectionId: (id: StationCollectionId) => void
}

const StationCollectionContext = createContext<StationCollectionContextValue | null>(null)

export const StationCollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [networkView, setNetworkViewState] = useState<NetworkViewFilter>(() => getStationNetworkView())
  const [networkId, setNetworkIdState] = useState<NetworkCollectionId>(() => getStationNetworkId())
  const [isSandbox, setSandboxState] = useState<boolean>(() => getStationSandboxMode())

  const collectionId = useMemo(
    () => deriveCollectionId(networkView, networkId, isSandbox),
    [networkView, networkId, isSandbox]
  )

  useEffect(() => {
    setStationCollectionName(collectionId)
  }, [collectionId])

  const setNetworkView = useCallback((view: NetworkViewFilter) => {
    setNetworkViewState(view)
    setStationNetworkView(view)
    if (view !== 'all') {
      setNetworkIdState(view)
    }
  }, [])

  const setNetworkId = useCallback((id: NetworkCollectionId) => {
    setNetworkIdState(id)
    setNetworkViewState(id)
    setStationNetworkId(id)
    setStationNetworkView(id)
  }, [])

  const setSandbox = useCallback((enabled: boolean) => {
    setSandboxState(enabled)
    setStationSandboxMode(enabled)
  }, [])

  const setCollectionId = useCallback((id: StationCollectionId) => {
    if (id === 'newsandboxstations1') {
      setSandbox(true)
      return
    }
    setSandbox(false)
    setNetworkId(id)
  }, [setNetworkId, setSandbox])

  return (
    <StationCollectionContext.Provider
      value={{
        networkView,
        setNetworkView,
        networkId,
        setNetworkId,
        isSandbox,
        setSandbox,
        collectionId,
        setCollectionId,
      }}
    >
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
