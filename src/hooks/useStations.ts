import { useState, useEffect } from 'react'
import { fetchStationsFromFirebase } from '../services/firebase'
import { calculateStats } from '../services/localData'
import type { Station, StationStats, UseStationsReturn } from '../types'
import { useStationCollection } from '../contexts/StationCollectionContext'

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

      // Fetch stations from Firebase (uses current collection from localStorage)
      const firebaseStations = await fetchStationsFromFirebase()
      
      if (firebaseStations.length > 0) {
        setStations(firebaseStations)
        setStats(calculateStats(firebaseStations))
      } else {
        throw new Error('No data available in Firebase')
      }

    } catch (error) {
      console.error('Failed to load stations:', error)
      setError('Unable to fetch station data from Firebase')
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
