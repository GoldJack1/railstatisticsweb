import { useState, useEffect } from 'react'
import { fetchStationsFromFirebase } from '../services/firebase'
import { fetchLocalStations, calculateStats } from '../services/localData'
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

  const checkLocalDataFlag = (): boolean => {
    // Check URL parameters for local data flag
    const urlParams = new URLSearchParams(window.location.search)
    const localFlag = urlParams.get('local') || urlParams.get('localData')
    
    // Check for localStorage flag
    const localStorageFlag = localStorage.getItem('useLocalDataOnly')
    
    // Check for environment variable (for development)
    const envFlag = import.meta.env.VITE_USE_LOCAL_DATA_ONLY === 'true'
    
    // In development mode, prioritize Firebase emulator over local data
    const isDevelopment = import.meta.env.DEV
    
    // Use local data if explicitly requested (localStorage takes priority)
    // In development, only use local data if explicitly requested via localStorage
    const shouldUseLocal = localStorageFlag === 'true' || 
                          (localFlag === 'true' || envFlag) && !isDevelopment
    
    
    return shouldUseLocal
  }

  const loadStations = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      // Check if we should use local data only
      const useLocalDataOnly = checkLocalDataFlag()
      console.log('useStations: useLocalDataOnly =', useLocalDataOnly)
      
      if (useLocalDataOnly) {
        console.log('useStations: Using local data')
        const localStations = await fetchLocalStations()
        setStations(localStations)
        setStats(calculateStats(localStations))
        return
      }

      // Try Firebase first, fallback to local data if needed
      try {
        const firebaseStations = await fetchStationsFromFirebase()
        
        if (firebaseStations.length > 0) {
          setStations(firebaseStations)
          setStats(calculateStats(firebaseStations))
        } else {
          throw new Error('No data in Firebase')
        }
      } catch {
        // Fallback to local data
        const localStations = await fetchLocalStations()
        setStations(localStations)
        setStats(calculateStats(localStations))
      }

    } catch (error) {
      console.error('Failed to load stations:', error)
      setError('Unable to fetch station data from any source')
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
