// Migration service for converting old format CSV to new format
import type { OldFormatStation, NewFormatStation, StationMatch, MigrationResult } from '../types/migration'
import { fetchStationsFromFirebase } from './firebase'

// Detect CSV format based on headers
const detectCSVFormat = (headers: string[]): 'format1' | 'format2' => {
  // Format 1: Has "Station Name" header
  // Format 2: Has "Type" and "Station" headers
  
  if (headers.includes('Type') && headers.includes('Station')) {
    console.log('Detected Format 2 (new format with Type column)')
    return 'format2'
  } else if (headers.includes('Station Name')) {
    console.log('Detected Format 1 (original format)')
    return 'format1'
  }
  
  // Default to format 1 if unclear
  console.log('Could not detect format clearly, defaulting to Format 1')
  return 'format1'
}

// Public function to detect format from CSV content
export const detectCSVFormatFromContent = (csvContent: string): { format: string; description: string } => {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 1) {
    return { format: 'unknown', description: 'Unable to detect format' }
  }
  
  const headers = parseCSVLine(lines[0])
  const format = detectCSVFormat(headers)
  
  if (format === 'format2') {
    return { 
      format: 'Format 2', 
      description: 'New format with Type column (e.g., stations_20250917214403.csv)' 
    }
  } else {
    return { 
      format: 'Format 1', 
      description: 'Original format with Station Name column' 
    }
  }
}

// Check if station is from an allowed country
const isAllowedCountry = (country: string): boolean => {
  const normalized = country.toLowerCase().trim()
  const allowedCountries = ['england', 'scotland', 'wales']
  return allowedCountries.includes(normalized)
}

// Filter stations by country
export const filterStationsByCountry = (stations: OldFormatStation[]): { 
  allowed: OldFormatStation[], 
  rejected: OldFormatStation[] 
} => {
  const allowed: OldFormatStation[] = []
  const rejected: OldFormatStation[] = []
  
  for (const station of stations) {
    if (isAllowedCountry(station.country)) {
      allowed.push(station)
    } else {
      rejected.push(station)
    }
  }
  
  console.log(`Filtered stations: ${allowed.length} allowed, ${rejected.length} rejected`)
  return { allowed, rejected }
}

// Clean number string (remove commas and quotes)
const cleanNumberString = (value: string): string => {
  if (!value || value === 'n/a' || value === 'N/A') return '0'
  return value.replace(/,/g, '').replace(/"/g, '').trim()
}

// Parse CSV content with auto-detection of format
export const parseOldFormatCSV = (csvContent: string): OldFormatStation[] => {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row')
  }

  const headers = parseCSVLine(lines[0])
  console.log('CSV Headers:', headers)
  console.log('Number of headers:', headers.length)
  
  // Detect which format we're dealing with
  const format = detectCSVFormat(headers)
  
  const stations: OldFormatStation[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (i <= 3) { // Log first few rows for debugging
      console.log(`Row ${i + 1} raw line:`, lines[i].substring(0, 200) + '...')
      console.log(`Row ${i + 1} parsed values (first 10):`, values.slice(0, 10))
    }
    if (values.length !== headers.length) {
      console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`)
      if (i <= 3) { // Log first few problematic rows
        console.log(`Row ${i + 1} first 10 values:`, values.slice(0, 10))
      }
      continue
    }

    const station: any = {}
    headers.forEach((header, index) => {
      station[header] = values[index]
    })

    // Map CSV headers to OldFormatStation interface properties based on format
    let mappedStation: OldFormatStation
    
    if (format === 'format2') {
      // New format with Type column
      mappedStation = {
        type: station['Type'] || '',
        stationName: station['Station'] || '',
        country: station['Country'] || '',
        county: station['County'] || '',
        operator: station['Operator'] || '',
        visited: station['Visited'] || '',
        visitDate: station['Visit Date DD/MM/YYYY'] || '',
        favorite: station['Favourite'] || '', // Note: British spelling
        latitude: station['Latitude'] || '',
        longitude: station['Longitude'] || '',
        // Copy all year columns, cleaning numeric values
        ...Object.fromEntries(
          Object.entries(station)
            .filter(([key]) => /^\d{4}$/.test(key)) // Only year columns (4 digits)
            .map(([key, value]) => [key, cleanNumberString(value as string)])
        )
      }
    } else {
      // Original format without Type column
      mappedStation = {
        stationName: station['Station Name'] || '',
        country: station['Country'] || '',
        county: station['County'] || '',
        operator: station['Operator'] || '',
        visited: station['Visited'] || '',
        visitDate: station['Visit Date'] || '',
        favorite: station['Favorite'] || '',
        latitude: station['Latitude'] || '',
        longitude: station['Longitude'] || '',
        // Copy all year columns
        ...Object.fromEntries(
          Object.entries(station).filter(([key]) => 
            /^\d{4}$/.test(key) // Only year columns (4 digits)
          )
        )
      }
    }

    stations.push(mappedStation)
    
    // Log first few parsed stations for debugging
    if (i <= 3) {
      console.log(`Parsed station ${i}:`, {
        type: mappedStation.type,
        stationName: mappedStation.stationName,
        country: mappedStation.country,
        county: mappedStation.county,
        operator: mappedStation.operator,
        visited: mappedStation.visited,
        favorite: mappedStation.favorite
      })
    }
  }

  console.log(`Total stations parsed: ${stations.length}`)
  return stations
}

// Parse a single CSV line handling quoted values and commas within numbers
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

// Load stations from Firebase for matching
const loadStationsForMatching = async (): Promise<any[]> => {
  try {
    console.log('Loading stations from Cloud Database for migration matching')
    const firebaseStations = await fetchStationsFromFirebase()
    
    if (firebaseStations.length > 0) {
      console.log(`Loaded ${firebaseStations.length} Firebase stations for matching`)
      return firebaseStations
    } else {
      throw new Error('No data available in Firebase')
    }
  } catch (error) {
    console.error('Failed to load stations for migration:', error)
    throw new Error('Unable to fetch station data from Firebase')
  }
}

// Match old format stations with available stations from Firebase
export const matchStations = async (
  oldStations: OldFormatStation[], 
  onProgress?: (progress: number, currentStation: string) => void
): Promise<{ matches: StationMatch[], availableStations: any[] }> => {
  try {
    const availableStations = await loadStationsForMatching()
    console.log(`Loaded ${availableStations.length} stations for matching`)
    
    // Log sample of available stations for debugging
    if (availableStations.length > 0) {
      console.log('Sample available stations:')
      for (let i = 0; i < Math.min(3, availableStations.length); i++) {
        const station = availableStations[i]
        console.log(`  ${i + 1}. "${station.stationName || station.stationname}" (${station.country}, ${station.county}, ${station.toc || station.TOC})`)
        console.log(`     ID: ${station.id}, CRS: ${station.crsCode || station.CrsCode}, TIPLOC: ${station.tiploc}`)
      }
    } else {
      console.warn('No stations loaded for matching!')
    }
    
    const matches: StationMatch[] = []

    // Log sample of old stations for debugging
    console.log('Sample old format stations:')
    for (let i = 0; i < Math.min(3, oldStations.length); i++) {
      const station = oldStations[i]
      console.log(`  ${i + 1}. "${station.stationName}" (${station.country}, ${station.county}, ${station.operator})`)
    }

    for (let i = 0; i < oldStations.length; i++) {
      const oldStation = oldStations[i]
      try {
        const match = findBestMatch(oldStation, availableStations)
        matches.push(match)
        
        // Update progress
        const progress = Math.round(((i + 1) / oldStations.length) * 100)
        onProgress?.(progress, oldStation.stationName)
        
        // Log first few matches for debugging
        if (i < 5) {
          console.log(`Station ${i + 1}: "${oldStation.stationName}" -> ${match.matchType} (${(match.confidence * 100).toFixed(1)}%)`)
          console.log(`  Old: "${oldStation.stationName}" (${oldStation.country}, ${oldStation.county}, ${oldStation.operator})`)
          if (match.firebaseStation) {
            console.log(`  Matched with: "${match.firebaseStation.stationName || match.firebaseStation.stationname}" (${match.firebaseStation.country}, ${match.firebaseStation.county}, ${match.firebaseStation.toc || match.firebaseStation.TOC})`)
          } else {
            console.log(`  No match found`)
          }
        }
        
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
        
        // Update progress even for errors
        const progress = Math.round(((i + 1) / oldStations.length) * 100)
        onProgress?.(progress, oldStation.stationName)
      }
    }

    console.log(`Completed matching ${matches.length} stations`)
    return { matches, availableStations }
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
  const oldCountry = (oldStation.country || '').toLowerCase().trim()
  const oldCounty = (oldStation.county || '').toLowerCase().trim()
  const oldTOC = (oldStation.operator || '').toLowerCase().trim()
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

  // 2. Try fuzzy name match with location/TOC validation
  if (!bestMatch) {
    for (const fbStation of firebaseStations) {
      const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
      if (typeof fbNameRaw !== 'string') continue
      
      const fbName = fbNameRaw.toLowerCase().trim()
      const similarity = calculateSimilarity(stationName, fbName)
      
      if (similarity > 0.3) { // Very permissive threshold for testing
        let matchConfidence = similarity
        
        // Boost confidence if country matches
        const fbCountry = (fbStation.country || '').toLowerCase().trim()
        if (oldCountry && fbCountry && fbCountry === oldCountry) {
          matchConfidence += 0.2
        }
        
        // Boost confidence if county matches
        const fbCounty = (fbStation.county || '').toLowerCase().trim()
        if (oldCounty && fbCounty && fbCounty === oldCounty) {
          matchConfidence += 0.15
        }
        
        // Boost confidence if TOC matches
        const fbTOC = (fbStation.toc || fbStation.TOC || '').toLowerCase().trim()
        if (oldTOC && fbTOC && fbTOC === oldTOC) {
          matchConfidence += 0.1
        }
        
        // Cap confidence at 1.0
        matchConfidence = Math.min(1.0, matchConfidence)
        
        if (matchConfidence > confidence) {
          bestMatch = fbStation
          matchType = 'fuzzy'
          confidence = matchConfidence
          suggestedId = fbStation.id || suggestedId
          suggestedCrsCode = fbStation.crsCode || fbStation.CrsCode || ''
          suggestedTiploc = fbStation.tiploc || ''
        }
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
        
        // If within 500 meters, consider it a match (increased from 100m)
        if (distance < 0.5) {
          let coordConfidence = Math.max(0.3, 1 - (distance * 2)) // Convert distance to confidence
          
          // Boost confidence if country matches
          const fbCountry = (fbStation.country || '').toLowerCase().trim()
          if (oldCountry && fbCountry && fbCountry === oldCountry) {
            coordConfidence += 0.2
          }
          
          if (coordConfidence > confidence) {
            bestMatch = fbStation
            matchType = 'coordinates'
            confidence = Math.min(1.0, coordConfidence)
            suggestedId = fbStation.id || suggestedId
            suggestedCrsCode = fbStation.crsCode || fbStation.CrsCode || ''
            suggestedTiploc = fbStation.tiploc || ''
          }
        }
      }
    }
  }

  // 4. Try partial name match (contains) as last resort
  if (!bestMatch) {
    for (const fbStation of firebaseStations) {
      const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
      if (typeof fbNameRaw !== 'string') continue
      
      const fbName = fbNameRaw.toLowerCase().trim()
      
      // Check if either name contains the other
      if ((stationName.includes(fbName) || fbName.includes(stationName)) && 
          Math.min(stationName.length, fbName.length) > 3) { // Avoid very short matches
        
        let partialConfidence = 0.4 // Base confidence for partial match
        
        // Boost confidence if country matches
        const fbCountry = (fbStation.country || '').toLowerCase().trim()
        if (oldCountry && fbCountry && fbCountry === oldCountry) {
          partialConfidence += 0.3
        }
        
        // Boost confidence if county matches
        const fbCounty = (fbStation.county || '').toLowerCase().trim()
        if (oldCounty && fbCounty && fbCounty === oldCounty) {
          partialConfidence += 0.2
        }
        
        // Boost confidence if TOC matches
        const fbTOC = (fbStation.toc || fbStation.TOC || '').toLowerCase().trim()
        if (oldTOC && fbTOC && fbTOC === oldTOC) {
          partialConfidence += 0.1
        }
        
        if (partialConfidence > confidence) {
          bestMatch = fbStation
          matchType = 'fuzzy'
          confidence = Math.min(1.0, partialConfidence)
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

// Format date to yyyy-mm-dd format
const formatDate = (dateString: string): string => {
  if (!dateString || dateString.trim() === '') {
    return ''
  }
  
  // If already in yyyy-mm-dd format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }
  
  // If in dd-mm-yyyy format, convert to yyyy-mm-dd
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    const parts = dateString.split('-')
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  
  // If in dd/mm/yyyy format, convert to yyyy-mm-dd
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const parts = dateString.split('/')
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  
  // If in yyyy/mm/dd format, convert to yyyy-mm-dd
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateString)) {
    return dateString.replace(/\//g, '-')
  }
  
  // For any other format, try to parse as a date and format it
  try {
    const date = new Date(dateString)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  } catch (error) {
    // If parsing fails, return the original string
  }
  
  // Return original string if no pattern matches
  return dateString
}

// Convert new stations from database to new format
const convertNewStationsToFormat = (newStations: any[], startingIndex: number): NewFormatStation[] => {
  const converted: NewFormatStation[] = []
  
  for (let i = 0; i < newStations.length; i++) {
    const station = newStations[i]
    const sequentialId = String(startingIndex + i + 1).padStart(4, '0')
    
    const newStation: NewFormatStation = {
      id: sequentialId,
      stnarea: 'GBNR',
      stationname: station.stationName || station.stationname || '',
      CrsCode: station.crsCode || station.CrsCode || '',
      tiploc: station.tiploc || '',
      country: station.country || '',
      county: station.county || '',
      TOC: station.toc || station.TOC || '',
      location: JSON.stringify({
        _latitude: station.latitude || 0,
        _longitude: station.longitude || 0
      }),
      'Is Visited': 'No',
      'Visit Dates': '',
      'Is Favorite': 'No'
    }

    // Add yearly usage data if available
    if (station.yearlyPassengers) {
      for (let year = 2024; year >= 1998; year--) {
        const yearStr = year.toString()
        newStation[yearStr] = station.yearlyPassengers[yearStr] || 0
      }
    } else {
      // Fill with zeros
      for (let year = 2024; year >= 1998; year--) {
        newStation[year.toString()] = 0
      }
    }

    converted.push(newStation)
  }

  return converted
}

// Convert matched stations to new format
export const convertToNewFormat = (matches: StationMatch[], newStations: any[] = []): NewFormatStation[] => {
  const converted: NewFormatStation[] = []
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const old = match.oldStation
    const firebase = match.firebaseStation
    
    // Generate zero-padded sequential ID (0001, 0002, etc.)
    const sequentialId = String(i + 1).padStart(4, '0')
    
    // Use matched station data when available, otherwise use old data
    const newStation: NewFormatStation = {
      id: sequentialId,
      stnarea: 'GBNR',
      // Use matched station name if available, otherwise use old station name
      stationname: firebase ? (firebase.stationName || firebase.stationname || old.stationName) : old.stationName,
      CrsCode: match.suggestedCrsCode,
      tiploc: match.suggestedTiploc,
      // Use matched station location data if available, otherwise use old data
      country: firebase ? (firebase.country || old.country) : old.country,
      county: firebase ? (firebase.county || old.county) : old.county,
      TOC: firebase ? (firebase.toc || firebase.TOC || old.operator) : old.operator,
      // Use old coordinates with proper JSON format to match newformat.csv
      location: JSON.stringify({
        _latitude: parseFloat(old.latitude),
        _longitude: parseFloat(old.longitude)
      }),
      // Preserve user data from old format, keeping Yes/No as strings
      'Is Visited': old.visited && old.visited.toLowerCase() === 'yes' ? 'Yes' : 'No',
      'Visit Dates': formatDate(old.visitDate),
      'Is Favorite': old.favorite && old.favorite.toLowerCase() === 'yes' ? 'Yes' : 'No'
    }

    // Add yearly usage data as individual year properties
    if (firebase && firebase.yearlyPassengers) {
      // Use Firebase/local yearly passenger data
      for (let year = 2024; year >= 1998; year--) {
        const yearStr = year.toString()
        newStation[yearStr] = firebase.yearlyPassengers[yearStr] || 0
      }
    } else {
      // Fallback to old data if no Firebase data available
      const years = Object.keys(old).filter(key => /^\d{4}$/.test(key))
      for (const year of years) {
        // Clean the number string (remove commas, handle n/a and N/A)
        const cleanValue = cleanNumberString(old[year] || '0')
        newStation[year] = parseInt(cleanValue) || 0
      }
      
      // Fill missing years with 0
      for (let year = 2024; year >= 1998; year--) {
        const yearStr = year.toString()
        if (!(yearStr in newStation)) {
          newStation[yearStr] = 0
        }
      }
    }

    converted.push(newStation)
  }

  // Add new stations (ID >= 2588) to the converted output
  if (newStations.length > 0) {
    const newStationsConverted = convertNewStationsToFormat(newStations, converted.length)
    converted.push(...newStationsConverted)
    console.log(`Added ${newStationsConverted.length} new stations (ID >= 2588) to converted output`)
  }

  return converted
}

// Generate migration result with country filtering
export const generateMigrationResult = (
  matches: StationMatch[], 
  rejectedStations: OldFormatStation[] = [],
  availableStations: any[] = []
): MigrationResult => {
  const unmatched = matches.filter(m => m.matchType === 'none').map(m => m.oldStation)
  
  // Find stations in database that were not matched (untracked stations)
  const matchedStationIds = new Set(
    matches
      .filter(m => m.firebaseStation !== null)
      .map(m => m.firebaseStation.id)
  )
  
  const untrackedStations = availableStations.filter(
    station => !matchedStationIds.has(station.id)
  )
  
  // Also find new stations (ID 2588 and above) that are likely not in CSV
  const newStations = availableStations.filter(station => {
    const stationId = parseInt(station.id)
    return !isNaN(stationId) && stationId >= 2588 && !matchedStationIds.has(station.id)
  })
  
  console.log(`Found ${untrackedStations.length} untracked stations (in database but not in CSV)`)
  console.log(`Found ${newStations.length} new stations (ID >= 2588)`)
  
  // Convert matches and automatically add new stations
  const converted = convertToNewFormat(matches, newStations)
  
  // Count visited and favorite stations
  const visitedCount = matches.filter(m => 
    m.oldStation.visited && 
    m.oldStation.visited.toLowerCase() === 'yes'
  ).length
  
  const favoritesCount = matches.filter(m => 
    m.oldStation.favorite && 
    m.oldStation.favorite.toLowerCase() === 'yes'
  ).length
  
  const stats = {
    total: matches.length + newStations.length, // Include new stations in total
    matched: matches.filter(m => m.matchType !== 'none').length,
    unmatched: unmatched.length,
    rejected: rejectedStations.length,
    untracked: untrackedStations.length,
    newStations: newStations.length,
    exactMatches: matches.filter(m => m.matchType === 'exact').length,
    fuzzyMatches: matches.filter(m => m.matchType === 'fuzzy').length,
    coordinateMatches: matches.filter(m => m.matchType === 'coordinates').length,
    visited: visitedCount,
    favorites: favoritesCount
  }

  return {
    matches,
    unmatched,
    rejected: rejectedStations,
    untracked: untrackedStations,
    newStations: newStations,
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

  // Define the exact column order with yearly usage grouped after Is Favorite
  const orderedHeaders = [
    'id',
    'stnarea', 
    'stationname',
    'CrsCode',
    'tiploc',
    'country',
    'county',
    'TOC',
    'location',
    'Is Visited',
    'Visit Dates',
    'Is Favorite'
  ]

  // Add year columns in descending order (2024 to 1998) after Is Favorite
  const yearColumns = []
  for (let year = 2024; year >= 1998; year--) {
    yearColumns.push(year.toString())
  }
  
  const allHeaders = [...orderedHeaders, ...yearColumns]

  const csvContent = [
    allHeaders.join(','),
    ...data.map(row => 
      allHeaders.map(header => {
        const value = row[header] || ''
        // Convert value to string to handle numbers, booleans, etc.
        const stringValue = String(value)
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
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

// Download JSON file
export const downloadJSON = (data: NewFormatStation[], filename: string = 'converted-stations.json'): void => {
  if (data.length === 0) {
    alert('No data to download')
    return
  }

  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Download rejected stations as CSV
export const downloadRejectedStationsCSV = (rejectedStations: OldFormatStation[], filename: string = 'rejected-stations.csv'): void => {
  if (rejectedStations.length === 0) {
    alert('No rejected stations to download')
    return
  }

  // Define headers based on the data structure
  const headers = [
    'Station Name',
    'Country',
    'County',
    'Operator',
    'Visited',
    'Visit Date',
    'Favorite',
    'Latitude',
    'Longitude'
  ]

  // Add year columns
  const years: string[] = []
  for (let year = 2024; year >= 1998; year--) {
    years.push(year.toString())
  }
  
  const allHeaders = [...headers, ...years]

  const csvContent = [
    allHeaders.join(','),
    ...rejectedStations.map(station => 
      [
        // Escape and quote if contains comma
        escapeCSVValue(station.stationName || ''),
        escapeCSVValue(station.country || ''),
        escapeCSVValue(station.county || ''),
        escapeCSVValue(station.operator || ''),
        escapeCSVValue(station.visited || ''),
        escapeCSVValue(station.visitDate || ''),
        escapeCSVValue(station.favorite || ''),
        station.latitude || '',
        station.longitude || '',
        // Add year data
        ...years.map(year => station[year] || '0')
      ].join(',')
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

// Helper to escape CSV values
const escapeCSVValue = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}