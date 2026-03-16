import { useState, useEffect } from 'react'
import { fetchStationsFromFirebase } from '../services/firebase'
import { fetchLocalStations, calculateStats } from '../services/localData'
import type { Station, StationStats, UseStationsReturn } from '../types'
import { useStationCollection } from '../contexts/StationCollectionContext'

const FIREBASE_TIMEOUT_MS = 12_000

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

  const loadStations = async (): Promise<void> => {
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
      const isDev = import.meta.env.DEV
      if (isDev) {
        // In dev, fall back to local data so local testing doesn't block
        const localStations = await fetchLocalStations()
        if (localStations.length > 0) {
          setStations(localStations)
          setStats(calculateStats(localStations))
          console.warn('Using local data after Firebase failed. Set VITE_USE_LOCAL_DATA_ONLY=true to skip Firebase in dev.')
        } else {
          setError('Unable to fetch station data from Firebase, and no local data found.')
        }
      } else {
        setError('Unable to fetch station data from Firebase')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStations()
  }, [collectionId]) // Refetch when user toggles station collection


  const refetch = (): void => {
    loadStations()
  }

  return {
    stations,
    loading,
    error,
    stats,
    refetch
  }
}
