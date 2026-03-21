import { useState, useEffect, useCallback } from 'react'
import { fetchStationsFromFirebase } from '../services/firebase'
import { calculateStats, fetchLocalStations } from '../services/localData'
import type { Station, StationStats, UseStationsReturn } from '../types'
import { useStationCollection } from '../contexts/StationCollectionContext'

const FIREBASE_TIMEOUT_MS = 12_000

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
  const { collectionId } = useStationCollection()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<StationStats>({
    totalStations: 0,
    withCoordinates: 0,
    withTOC: 0,
    withPassengers: 0
  })

  const loadStations = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const useLocalOnly = import.meta.env.VITE_USE_LOCAL_DATA_ONLY === 'true'

      if (useLocalOnly) {
        const localStations = await fetchLocalStations()
        if (localStations.length > 0) {
          setStations(localStations)
          setStats(calculateStats(localStations))
        } else {
          setError('No local data. Add public/data/stations.json or set VITE_USE_LOCAL_DATA_ONLY=false.')
        }
        return
      }

      // Firebase: in dev, use a timeout so we don't hang if config is missing or network fails
      const isDev = import.meta.env.DEV
      let firebaseStations: Station[]

      if (isDev) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firebase request timed out')), FIREBASE_TIMEOUT_MS)
        )
        firebaseStations = await Promise.race([
          fetchStationsFromFirebase(collectionId),
          timeoutPromise
        ])
      } else {
        firebaseStations = await fetchStationsFromFirebase(collectionId)
      }

      if (firebaseStations.length > 0) {
        setStations(firebaseStations)
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
  }, [collectionId])

  useEffect(() => {
    void loadStations()
  }, [loadStations]) // Refetch when user toggles station collection

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
