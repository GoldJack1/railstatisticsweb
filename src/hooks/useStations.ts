import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchStationsFromFirebase,
  fetchAllNetworkStationsFromFirebase,
} from '../services/firebase'
import { calculateStats, fetchLocalStations } from '../services/localData'
import type { Station, StationStats, UseStationsReturn } from '../types'
import { useStationCollection } from '../contexts/StationCollectionContext'

const FIREBASE_TIMEOUT_MS = 12_000
const SANDBOX_COLLECTION_ID = 'newsandboxstations1'

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

export const useStations = (): UseStationsReturn => {
  const { isSandbox } = useStationCollection()
  const [networkStations, setNetworkStations] = useState<Station[]>([])
  const [sandboxStations, setSandboxStations] = useState<Station[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<StationStats>({
    totalStations: 0,
    withCoordinates: 0,
    withTOC: 0,
    withPassengers: 0
  })
  const networksLoadedRef = useRef(false)
  const sandboxLoadedRef = useRef(false)

  const stations = isSandbox ? sandboxStations : networkStations

  const loadStations = useCallback(async (): Promise<void> => {
    try {
      setError(null)

      const useLocalOnly = import.meta.env.VITE_USE_LOCAL_DATA_ONLY === 'true'

      if (useLocalOnly) {
        setLoading(true)
        const localStations = await fetchLocalStations()
        if (localStations.length > 0) {
          setNetworkStations(localStations)
          setStats(calculateStats(localStations))
          networksLoadedRef.current = true
        } else {
          setError('No local data. Add public/data/stations.json or set VITE_USE_LOCAL_DATA_ONLY=false.')
        }
        return
      }

      const hasCached = isSandbox ? sandboxLoadedRef.current : networksLoadedRef.current
      if (!hasCached) {
        setLoading(true)
      }

      const isDev = import.meta.env.DEV
      const fetchData = async (): Promise<Station[]> => {
        if (isSandbox) {
          return fetchStationsFromFirebase(SANDBOX_COLLECTION_ID)
        }
        return fetchAllNetworkStationsFromFirebase()
      }

      let firebaseStations: Station[]
      if (isDev) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firebase request timed out')), FIREBASE_TIMEOUT_MS)
        )
        firebaseStations = await Promise.race([fetchData(), timeoutPromise])
      } else {
        firebaseStations = await fetchData()
      }

      if (firebaseStations.length > 0) {
        if (isSandbox) {
          setSandboxStations(firebaseStations)
          sandboxLoadedRef.current = true
        } else {
          setNetworkStations(firebaseStations)
          networksLoadedRef.current = true
        }
        setStats(calculateStats(firebaseStations))
      } else {
        throw new Error('No data available in Firebase')
      }
    } catch (err) {
      console.error('Failed to load stations:', err)
      const details = getErrorMessage(err)
      const isDev = import.meta.env.DEV
      const hint = isDev
        ? 'Check your `.env.local` Firebase config (VITE_FIREBASE_*). Local JSON fallback is disabled.'
        : 'Please try again later.'
      setError(`Unable to fetch station data from Firebase. ${hint}${details ? ` (${details})` : ''}`)
    } finally {
      setLoading(false)
    }
  }, [isSandbox])

  useEffect(() => {
    void loadStations()
  }, [loadStations])

  useEffect(() => {
    const onRefetch = () => {
      void loadStations()
    }
    window.addEventListener('railstats-stations-refetch', onRefetch)
    return () => window.removeEventListener('railstats-stations-refetch', onRefetch)
  }, [loadStations])

  const refetch = (): void => {
    void loadStations()
  }

  return {
    stations,
    loading,
    error,
    stats,
    refetch
  }
}
