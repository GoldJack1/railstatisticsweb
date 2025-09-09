import { useState, useEffect } from 'react'
import { fetchStationsFromFirebase } from '../services/firebase'
import { fetchLocalStations, calculateStats } from '../services/localData'

export const useStations = () => {
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    totalStations: 0,
    withCoordinates: 0,
    withTOC: 0,
    withPassengers: 0
  })

  const checkLocalDataFlag = () => {
    // Check URL parameters for local data flag
    const urlParams = new URLSearchParams(window.location.search)
    const localFlag = urlParams.get('local') || urlParams.get('localData')
    
    // Check for localStorage flag
    const localStorageFlag = localStorage.getItem('useLocalDataOnly')
    
    // Check for environment variable (for development)
    const envFlag = import.meta.env.VITE_USE_LOCAL_DATA_ONLY === 'true' || import.meta.env.VITE_USE_LOCAL_DATA_ONLY === true
    
    // In development mode, prioritize Firebase emulator over local data
    const isDevelopment = import.meta.env.DEV
    
    // Only use local data if explicitly requested or in production without Firebase
    const shouldUseLocal = (localFlag === 'true' || 
                          localStorageFlag === 'true' || 
                          envFlag === true) && !isDevelopment
    
    
    return shouldUseLocal
  }

  const loadStations = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if we should use local data only
      const useLocalDataOnly = checkLocalDataFlag()
      
      if (useLocalDataOnly) {
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
      } catch (firebaseError) {
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
  }, [])

  const refetch = () => {
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
