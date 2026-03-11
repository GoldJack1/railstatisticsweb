// Local Data Service
// This service provides local station data for development and testing

import type { Station, StationStats } from '../types'

/** Try stations.json first, then stations-sample.json so dev works without a full copy. */
export const fetchLocalStations = async (): Promise<Station[]> => {
  for (const path of ['/data/stations.json', '/data/stations-sample.json']) {
    try {
      const response = await fetch(path)
      if (response.ok) {
        const stations = await response.json()
        if (Array.isArray(stations) && stations.length > 0) {
          console.log(`Loaded ${stations.length} stations from ${path}`)
          return stations
        }
      }
    } catch (error) {
      console.warn(`Failed to load ${path}:`, error)
    }
  }
  console.warn('No local station data found')
  return []
}

export const fetchLocalStats = async (): Promise<StationStats | null> => {
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

export const calculateStats = (stations: Station[]): StationStats => {
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
