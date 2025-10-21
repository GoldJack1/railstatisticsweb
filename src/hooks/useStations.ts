import { useState, useEffect } from 'react'
import { fetchStationsFromFirebase } from '../services/firebase'
import { calculateStats } from '../services/localData'
import type { Station, StationStats, UseStationsReturn } from '../types'

export const useStations = (): UseStationsReturn => {
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

      // Fetch stations from Firebase
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


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
