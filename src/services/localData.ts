// Local Data Service
// This service provides local station data for development and testing

export const fetchLocalStations = async (): Promise<any[]> => {
  try {
    const response = await fetch('/data/stations.json')
    
    if (response.ok) {
      const stations = await response.json()
      return stations
    } else {
      console.warn('Could not load local data file')
      return []
    }
    
  } catch (error) {
    console.error('Failed to load local data:', error)
    return []
  }
}

export const fetchLocalStats = async (): Promise<any> => {
  try {
    const response = await fetch('/data/stats.json')
    if (response.ok) {
      const stats = await response.json()
      return stats
    }
    return null
  } catch (error) {
    console.warn('Could not load stats file:', error)
    return null
  }
}

export const calculateStats = (stations: any[]): { totalStations: number; withCoordinates: number; withTOC: number; withPassengers: number } => {
  if (!stations || stations.length === 0) {
    return {
      totalStations: 0,
      withCoordinates: 0,
      withTOC: 0,
      withPassengers: 0
    }
  }

  return {
    totalStations: stations.length,
    withCoordinates: stations.filter(s => s.latitude !== 0 && s.longitude !== 0).length,
    withTOC: stations.filter(s => s.toc && s.toc.trim() !== '').length,
    withPassengers: stations.filter(s => s.yearlyPassengers && 
      (typeof s.yearlyPassengers === 'number' || 
       (typeof s.yearlyPassengers === 'object' && Object.keys(s.yearlyPassengers).length > 0))).length
  }
}
