// Migration service for converting old format CSV to new format
import type { OldFormatStation, NewFormatStation, StationMatch, MigrationResult } from '../types/migration'
import { fetchStationsFromFirebase } from './firebase'
import { fetchLocalStations } from './localData'

// Parse CSV content
export const parseOldFormatCSV = (csvContent: string): OldFormatStation[] => {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row')
  }

  const headers = parseCSVLine(lines[0])
  const stations: OldFormatStation[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) {
      console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`)
      continue
    }

    const station: any = {}
    headers.forEach((header, index) => {
      station[header] = values[index]
    })

    stations.push(station as OldFormatStation)
  }

  return stations
}

// Parse a single CSV line handling quoted values
const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

// Check if we should use local data only (same logic as useStations hook)
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
  
  // Only use local data if explicitly requested or in production without Firebase
  const shouldUseLocal = (localFlag === 'true' || 
                        localStorageFlag === 'true' || 
                        envFlag) && !isDevelopment
  
  return shouldUseLocal
}

// Load stations using the same logic as useStations hook
const loadStationsForMatching = async (): Promise<any[]> => {
  try {
    // Check if we should use local data only
    const useLocalDataOnly = checkLocalDataFlag()
    
    if (useLocalDataOnly) {
      console.log('Using local data for migration matching')
      const localStations = await fetchLocalStations()
      return localStations
    }

    // Try Firebase first, fallback to local data if needed
    try {
      console.log('Attempting to load Firebase stations for migration matching')
      const firebaseStations = await fetchStationsFromFirebase()
      
      if (firebaseStations.length > 0) {
        console.log(`Loaded ${firebaseStations.length} Firebase stations for matching`)
        return firebaseStations
      } else {
        throw new Error('No data in Firebase')
      }
    } catch (firebaseError) {
      console.warn('Firebase failed, falling back to local data:', firebaseError)
      // Fallback to local data
      const localStations = await fetchLocalStations()
      console.log(`Loaded ${localStations.length} local stations for matching`)
      return localStations
    }

  } catch (error) {
    console.error('Failed to load stations for migration:', error)
    throw new Error('Unable to fetch station data from any source')
  }
}

// Match old format stations with available stations (Firebase or local)
export const matchStations = async (oldStations: OldFormatStation[]): Promise<StationMatch[]> => {
  try {
    const availableStations = await loadStationsForMatching()
    console.log(`Loaded ${availableStations.length} stations for matching`)
    
    const matches: StationMatch[] = []

    for (let i = 0; i < oldStations.length; i++) {
      const oldStation = oldStations[i]
      try {
        const match = findBestMatch(oldStation, availableStations)
        matches.push(match)
        
        // Log progress every 100 stations
        if ((i + 1) % 100 === 0) {
          console.log(`Processed ${i + 1}/${oldStations.length} stations`)
        }
      } catch (error) {
        console.error(`Error matching station ${i + 1} (${oldStation.stationName}):`, error)
        // Add a fallback match for this station
        matches.push({
          oldStation,
          firebaseStation: null,
          matchType: 'none',
          confidence: 0,
          suggestedId: generateId(),
          suggestedCrsCode: '',
          suggestedTiploc: ''
        })
      }
    }

    console.log(`Completed matching ${matches.length} stations`)
    return matches
  } catch (error) {
    console.error('Error in matchStations:', error)
    throw error
  }
}

// Find the best match for a station
const findBestMatch = (oldStation: OldFormatStation, firebaseStations: any[]): StationMatch => {
  // Safety check for station name
  if (!oldStation.stationName || typeof oldStation.stationName !== 'string') {
    console.warn('Invalid station name:', oldStation.stationName)
    return {
      oldStation,
      firebaseStation: null,
      matchType: 'none',
      confidence: 0,
      suggestedId: generateId(),
      suggestedCrsCode: '',
      suggestedTiploc: ''
    }
  }
  
  const stationName = oldStation.stationName.toLowerCase().trim()
  const oldLat = parseFloat(oldStation.latitude)
  const oldLng = parseFloat(oldStation.longitude)

  let bestMatch: any = null
  let matchType: 'exact' | 'fuzzy' | 'coordinates' | 'none' = 'none'
  let confidence = 0
  let suggestedId = generateId()
  let suggestedCrsCode = ''
  let suggestedTiploc = ''

  // 1. Try exact name match
  for (const fbStation of firebaseStations) {
    const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
    if (typeof fbNameRaw !== 'string') continue
    
    const fbName = fbNameRaw.toLowerCase().trim()
    if (fbName === stationName) {
      bestMatch = fbStation
      matchType = 'exact'
      confidence = 1.0
      suggestedId = fbStation.id || suggestedId
      suggestedCrsCode = fbStation.crsCode || fbStation.CrsCode || ''
      suggestedTiploc = fbStation.tiploc || ''
      break
    }
  }

  // 2. Try fuzzy name match if no exact match
  if (!bestMatch) {
    for (const fbStation of firebaseStations) {
      const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
      if (typeof fbNameRaw !== 'string') continue
      
      const fbName = fbNameRaw.toLowerCase().trim()
      const similarity = calculateSimilarity(stationName, fbName)
      
      if (similarity > 0.8 && similarity > confidence) {
        bestMatch = fbStation
        matchType = 'fuzzy'
        confidence = similarity
        suggestedId = fbStation.id || suggestedId
        suggestedCrsCode = fbStation.crsCode || fbStation.CrsCode || ''
        suggestedTiploc = fbStation.tiploc || ''
      }
    }
  }

  // 3. Try coordinate match if no name match
  if (!bestMatch && !isNaN(oldLat) && !isNaN(oldLng)) {
    for (const fbStation of firebaseStations) {
      const fbLat = fbStation.latitude
      const fbLng = fbStation.longitude
      
      if (fbLat && fbLng) {
        const distance = calculateDistance(oldLat, oldLng, fbLat, fbLng)
        
        // If within 100 meters, consider it a match
        if (distance < 0.1 && distance < confidence) {
          bestMatch = fbStation
          matchType = 'coordinates'
          confidence = Math.max(0.5, 1 - (distance * 10)) // Convert distance to confidence
          suggestedId = fbStation.id || suggestedId
          suggestedCrsCode = fbStation.crsCode || fbStation.CrsCode || ''
          suggestedTiploc = fbStation.tiploc || ''
        }
      }
    }
  }

  return {
    oldStation,
    firebaseStation: bestMatch,
    matchType,
    confidence,
    suggestedId,
    suggestedCrsCode,
    suggestedTiploc
  }
}

// Calculate string similarity using Levenshtein distance
const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const distance = levenshteinDistance(longer, shorter)
  return (longer.length - distance) / longer.length
}

// Calculate Levenshtein distance
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      )
    }
  }
  
  return matrix[str2.length][str1.length]
}

// Calculate distance between two coordinates in kilometers
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Generate a new ID for unmatched stations
const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9).toUpperCase()
}

// Convert matched stations to new format
export const convertToNewFormat = (matches: StationMatch[]): NewFormatStation[] => {
  const converted: NewFormatStation[] = []
  
  for (const match of matches) {
    const old = match.oldStation
    const newStation: NewFormatStation = {
      id: match.suggestedId,
      stnarea: 'GBNR',
      stationname: old.stationName,
      CrsCode: match.suggestedCrsCode,
      tiploc: match.suggestedTiploc,
      country: old.country,
      county: old.county,
      TOC: old.operator,
      location: JSON.stringify({
        _latitude: parseFloat(old.latitude),
        _longitude: parseFloat(old.longitude)
      }),
      'Is Visited': old.visited,
      'Visit Dates': old.visitDate,
      'Is Favorite': old.favorite
    }

    // Add year columns
    const years = Object.keys(old).filter(key => /^\d{4}$/.test(key))
    for (const year of years) {
      newStation[year] = old[year]
    }

    converted.push(newStation)
  }

  return converted
}

// Generate migration result
export const generateMigrationResult = (matches: StationMatch[]): MigrationResult => {
  const unmatched = matches.filter(m => m.matchType === 'none').map(m => m.oldStation)
  const converted = convertToNewFormat(matches)
  
  const stats = {
    total: matches.length,
    matched: matches.filter(m => m.matchType !== 'none').length,
    unmatched: unmatched.length,
    exactMatches: matches.filter(m => m.matchType === 'exact').length,
    fuzzyMatches: matches.filter(m => m.matchType === 'fuzzy').length,
    coordinateMatches: matches.filter(m => m.matchType === 'coordinates').length
  }

  return {
    matches,
    unmatched,
    converted,
    stats
  }
}

// Download CSV file
export const downloadCSV = (data: NewFormatStation[], filename: string = 'converted-stations.csv'): void => {
  if (data.length === 0) {
    alert('No data to download')
    return
  }

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] || ''
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}