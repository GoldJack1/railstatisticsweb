// Migration service for converting old format CSV to new format
import type { OldFormatStation, NewFormatStation, StationMatch, MigrationResult, ColumnMapping, FirebaseStationLike } from '../types/migration'
import { fetchStationsFromFirebase, getStationCollectionName, type StationCollectionId } from './firebase'

// Normalize a header for comparison (strip BOM, trim, collapse spaces)
const normalizeHeader = (h: string): string =>
  h.replace(/\uFEFF/g, '').trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ')

// Detect CSV format based on headers (order matters: prefer format1/2 when they match)
const detectCSVFormat = (headers: string[]): 'format1' | 'format2' | 'format3' => {
  const normalized = headers.map(normalizeHeader)
  const lower = normalized.map((h) => h.toLowerCase())

  // Format 1: "Station Name" (two words) – check before format3 so we don’t mis-detect
  if (normalized.some((h) => h.toLowerCase() === 'station name')) {
    console.log('Detected Format 1 (original format with Station Name column)')
    return 'format1'
  }
  // Format 2: Type + Station
  if (normalized.some((h) => h === 'Type') && normalized.some((h) => h === 'Station')) {
    console.log('Detected Format 2 (new format with Type column)')
    return 'format2'
  }
  // Format 3: stationname (one word) + location (JSON) – no "Station Name" or separate Lat/Long
  const hasStationName = lower.some((h) => h === 'station name')
  const hasSeparateLatLong = lower.includes('latitude') && lower.includes('longitude')
  if (
    lower.includes('stationname') &&
    lower.includes('location') &&
    !hasStationName &&
    !hasSeparateLatLong
  ) {
    console.log('Detected Format 3 (stationname, country, county, TOC, location)')
    return 'format3'
  }
  console.log('Could not detect format clearly, defaulting to Format 1')
  return 'format1'
}

// Get value from row by header name (case-insensitive), for format3
const getByHeader = (station: Record<string, string>, headers: string[], headerName: string): string => {
  const key = headers.find((h) => h.toLowerCase().trim() === headerName.toLowerCase())
  return (key ? station[key] : '') || ''
}

// Parse location JSON e.g. {"_latitude":51.49,"_longitude":0.12} or {"_latitude":-2.334345,"_longitude":2.334345}
const parseLocationField = (value: string): { latitude: string; longitude: string } => {
  const out = { latitude: '', longitude: '' }
  if (!value || typeof value !== 'string') return out
  try {
    const raw = value.trim()
    const parsed = raw.startsWith('{') ? JSON.parse(raw) : {}
    const lat = parsed._latitude ?? parsed.latitude ?? parsed.lat
    const lng = parsed._longitude ?? parsed.longitude ?? parsed.long ?? parsed.lng
    if (lat != null && !isNaN(Number(lat))) out.latitude = String(lat)
    if (lng != null && !isNaN(Number(lng))) out.longitude = String(lng)
  } catch {
    // ignore
  }
  return out
}

// Public function to detect format from CSV content
export const detectCSVFormatFromContent = (csvContent: string): { format: string; description: string } => {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 1) {
    return { format: 'unknown', description: 'Unable to detect format' }
  }

  const headers = trimTrailingEmptyColumns(parseCSVLine(lines[0]))
  const format = detectCSVFormat(headers)
  
  if (format === 'format3') {
    return {
      format: 'Format 3',
      description: 'Headers: stationname, country, county, TOC, location (JSON with _latitude/_longitude)'
    }
  }
  if (format === 'format2') {
    return {
      format: 'Format 2',
      description: 'New format with Type column (e.g., stations_20250917214403.csv)'
    }
  }
  return {
    format: 'Format 1',
    description: 'Original format with Station Name column'
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

// Parse lat/long for output: return 0 when missing, null, or invalid so JSON is valid
const safeLatLng = (value: string | undefined | null): number => {
  if (value === undefined || value === null || String(value).trim() === '') return 0
  const n = parseFloat(String(value).trim())
  return isNaN(n) ? 0 : n
}

/** Parse CSV to raw headers and rows (no format detection). Used for mapping step. */
export const getRawCSV = (csvContent: string): { headers: string[]; rows: string[][] } => {
  const content = csvContent.replace(/^\uFEFF/, '')
  const lines = content.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new Error('CSV must have a header and at least one row')
  const headers = trimTrailingEmptyColumns(parseCSVLine(lines[0])).map(normalizeHeader)
  const expectedLen = headers.length
  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    const values = trimTrailingEmptyColumns(parseCSVLine(lines[i]))
    // Normalize row length so we never drop rows: take first N columns or pad with ''
    if (values.length >= expectedLen) {
      rows.push(values.slice(0, expectedLen))
    } else {
      rows.push([...values, ...Array(expectedLen - values.length).fill('')])
    }
  }
  return { headers, rows }
}

/** Suggest column mapping from headers (case-insensitive match). */
export const suggestColumnMapping = (headers: string[]): ColumnMapping => {
  const lower = headers.map((h) => h.toLowerCase())
  const find = (...names: string[]): string => {
    const i = lower.findIndex((l) => names.some((n) => l === n.toLowerCase()))
    return i >= 0 ? headers[i] : ''
  }
  return {
    stationName: find('Station Name', 'Station', 'stationname'),
    country: find('Country', 'country'),
    county: find('County', 'county'),
    operator: find('Operator', 'Operator', 'TOC', 'toc'),
    visited: find('Visited', 'Is Visited', 'visited'),
    visitDate: find('Visit Date', 'Visit Dates', 'Visit Date DD/MM/YYYY', 'visit date'),
    favorite: find('Favorite', 'Is Favorite', 'Favourite', 'favorite'),
    latitude: find('Latitude', 'latitude'),
    longitude: find('Longitude', 'longitude'),
    location: find('location', 'Location') || undefined
  }
}

/** Parse CSV using user-provided column mapping into OldFormatStation[]. */
export const parseCSVWithColumnMapping = (csvContent: string, mapping: ColumnMapping): OldFormatStation[] => {
  const { headers, rows } = getRawCSV(csvContent)
  const idx = (headerName: string): number => (headerName ? headers.indexOf(headerName) : -1)
  const get = (row: string[], key: keyof ColumnMapping): string => {
    const h = mapping[key]
    if (!h) return ''
    const i = idx(h)
    return i >= 0 ? (row[i] ?? '').trim() : ''
  }
  const stations: OldFormatStation[] = []
  const locCol = mapping.location ? idx(mapping.location) : -1
  for (const row of rows) {
    let lat = get(row, 'latitude')
    let lng = get(row, 'longitude')
    if (locCol >= 0 && row[locCol]) {
      const parsed = parseLocationField(row[locCol].trim())
      if (parsed.latitude || parsed.longitude) {
        lat = parsed.latitude
        lng = parsed.longitude
      }
    }
    const yearEntries = Object.fromEntries(
      headers
        .filter((h) => /^\d{4}$/.test(h))
        .map((h) => {
          const colIdx = headers.indexOf(h)
          return [h, cleanNumberString((row[colIdx] ?? '') as string)]
        })
    )
    stations.push({
      stationName: get(row, 'stationName'),
      country: get(row, 'country'),
      county: get(row, 'county'),
      operator: get(row, 'operator'),
      visited: get(row, 'visited'),
      visitDate: get(row, 'visitDate'),
      favorite: get(row, 'favorite'),
      latitude: lat,
      longitude: lng,
      ...yearEntries
    })
  }
  return stations
}

// Parse CSV content with auto-detection of format
export const parseOldFormatCSV = (csvContent: string): OldFormatStation[] => {
  const content = csvContent.replace(/^\uFEFF/, '') // strip BOM
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row')
  }

  const headers = trimTrailingEmptyColumns(parseCSVLine(lines[0])).map(normalizeHeader)
  console.log('CSV Headers:', headers)
  console.log('Number of headers:', headers.length)

  // Detect which format we're dealing with
  const format = detectCSVFormat(headers)

  const stations: OldFormatStation[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = trimTrailingEmptyColumns(parseCSVLine(lines[i]))
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

    const station: Record<string, string> = {}
    headers.forEach((header, index) => {
      station[header] = values[index]
    })

    // Map CSV headers to OldFormatStation interface properties based on format
    let mappedStation: OldFormatStation

    if (format === 'format3') {
      // stationname, country, county, TOC, location (JSON)
      const loc = parseLocationField(getByHeader(station, headers, 'location'))
      mappedStation = {
        stationName: getByHeader(station, headers, 'stationname'),
        country: getByHeader(station, headers, 'country'),
        county: getByHeader(station, headers, 'county'),
        operator: getByHeader(station, headers, 'TOC'),
        visited: getByHeader(station, headers, 'Visited') || getByHeader(station, headers, 'Is Visited') || '',
        visitDate: getByHeader(station, headers, 'Visit Date') || getByHeader(station, headers, 'Visit Dates') || '',
        favorite: getByHeader(station, headers, 'Favorite') || getByHeader(station, headers, 'Is Favorite') || getByHeader(station, headers, 'Favourite') || '',
        latitude: loc.latitude,
        longitude: loc.longitude,
        ...Object.fromEntries(
          Object.entries(station)
            .filter(([key]) => /^\d{4}$/.test(key))
            .map(([key, value]) => [key, cleanNumberString(value as string)])
        )
      }
    } else if (format === 'format2') {
      // New format with Type column (case-insensitive header lookup)
      mappedStation = {
        type: getByHeader(station, headers, 'Type'),
        stationName: getByHeader(station, headers, 'Station'),
        country: getByHeader(station, headers, 'Country'),
        county: getByHeader(station, headers, 'County'),
        operator: getByHeader(station, headers, 'Operator'),
        visited: getByHeader(station, headers, 'Visited'),
        visitDate: getByHeader(station, headers, 'Visit Date DD/MM/YYYY'),
        favorite: getByHeader(station, headers, 'Favourite') || getByHeader(station, headers, 'Favorite'),
        latitude: getByHeader(station, headers, 'Latitude'),
        longitude: getByHeader(station, headers, 'Longitude'),
        ...Object.fromEntries(
          Object.entries(station)
            .filter(([key]) => /^\d{4}$/.test(key))
            .map(([key, value]) => [key, cleanNumberString(value as string)])
        )
      }
    } else {
      // Format 1: original format (case-insensitive header lookup so Visited/Station Name always found)
      mappedStation = {
        stationName: getByHeader(station, headers, 'Station Name'),
        country: getByHeader(station, headers, 'Country'),
        county: getByHeader(station, headers, 'County'),
        operator: getByHeader(station, headers, 'Operator'),
        visited: getByHeader(station, headers, 'Visited'),
        visitDate: getByHeader(station, headers, 'Visit Date'),
        favorite: getByHeader(station, headers, 'Favorite'),
        latitude: getByHeader(station, headers, 'Latitude'),
        longitude: getByHeader(station, headers, 'Longitude'),
        ...Object.fromEntries(
          Object.entries(station).filter(([key]) => /^\d{4}$/.test(key))
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

// Strip trailing empty columns so header/row length matches when CSV has trailing commas
const trimTrailingEmptyColumns = (columns: string[]): string[] => {
  const trimmed = [...columns]
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') {
    trimmed.pop()
  }
  return trimmed
}

// Load stations from Firebase for matching (collection from caller so dropdown value at click time is used)
const loadStationsForMatching = async (collectionName: StationCollectionId): Promise<FirebaseStationLike[]> => {
  try {
    console.log(`Loading stations from Cloud Database for migration matching (collection: ${collectionName})`)
    const firebaseStations = await fetchStationsFromFirebase(collectionName)
    
    if (firebaseStations.length > 0) {
      console.log(`Loaded ${firebaseStations.length} Firebase stations for matching`)
      // `fetchStationsFromFirebase` returns our `Station` shape, which is compatible with `FirebaseStationLike`.
      return firebaseStations
    } else {
      throw new Error('No data available in Firebase')
    }
  } catch (error) {
    console.error('Failed to load stations for migration:', error)
    throw new Error('Unable to fetch station data from Firebase')
  }
}

/** Progress updates while matching (yields to the UI between batches so % is visible). */
export type MatchStationsProgressInfo = {
  phase: 'loading-db' | 'matching'
  /** Overall 0–100 for the modal */
  percent: number
  statusLine: string
  currentStationName?: string
  index?: number
  total?: number
}

const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })

// Match old format stations with available stations from Firebase (pass collectionId so dropdown value is used)
export const matchStations = async (
  oldStations: OldFormatStation[],
  onProgress?: (info: MatchStationsProgressInfo) => void,
  collectionId?: StationCollectionId
): Promise<{ matches: StationMatch[], availableStations: FirebaseStationLike[] }> => {
  try {
    onProgress?.({
      phase: 'loading-db',
      percent: 4,
      statusLine: 'Connecting to the live station database…'
    })
    await yieldToUi()

    const collection = collectionId ?? getStationCollectionName()
    const availableStations = await loadStationsForMatching(collection)
    onProgress?.({
      phase: 'loading-db',
      percent: 14,
      statusLine: `Loaded ${availableStations.length.toLocaleString()} stations — starting row matching…`
    })
    await yieldToUi()

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
    const total = oldStations.length
    /** ~1 rAF yield per ~1.5% of rows so React can paint (caps work on huge CSVs). */
    const yieldEvery = Math.max(1, Math.ceil(total / 70))

    // Log sample of old stations for debugging
    console.log('Sample old format stations:')
    for (let i = 0; i < Math.min(3, oldStations.length); i++) {
      const station = oldStations[i]
      console.log(`  ${i + 1}. "${station.stationName}" (${station.country}, ${station.county}, ${station.operator})`)
    }

    for (let i = 0; i < total; i++) {
      const oldStation = oldStations[i]
      try {
        const match = findBestMatch(oldStation, availableStations)
        matches.push(match)

        // 15%–92% while matching rows (load phase used 4–14%)
        const rowFraction = total === 0 ? 1 : (i + 1) / total
        const percent = 15 + Math.round(rowFraction * 77)
        onProgress?.({
          phase: 'matching',
          percent,
          statusLine: `Matching row ${i + 1} of ${total}`,
          currentStationName: oldStation.stationName,
          index: i + 1,
          total
        })

        if (i % yieldEvery === 0 || i === total - 1) {
          await yieldToUi()
        }
        
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
          console.log(`Processed ${i + 1}/${total} stations`)
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

        const rowFraction = total === 0 ? 1 : (i + 1) / total
        const percent = 15 + Math.round(rowFraction * 77)
        onProgress?.({
          phase: 'matching',
          percent,
          statusLine: `Matching row ${i + 1} of ${total}`,
          currentStationName: oldStation.stationName,
          index: i + 1,
          total
        })

        if (i % yieldEvery === 0 || i === total - 1) {
          await yieldToUi()
        }
      }
    }

    onProgress?.({
      phase: 'matching',
      percent: 98,
      statusLine: 'Building results…',
      currentStationName: undefined,
      index: total,
      total
    })
    await yieldToUi()

    console.log(`Completed matching ${matches.length} stations`)
    return { matches, availableStations }
  } catch (error) {
    console.error('Error in matchStations:', error)
    throw error
  }
}

// Country/county must agree when both sides have them (avoids cross-country or wrong-region matches)
const countryCountyCompatible = (
  oldCountry: string,
  oldCounty: string,
  fbCountry: string,
  fbCounty: string
): boolean => {
  if (oldCountry && fbCountry && oldCountry !== fbCountry) return false
  if (!oldCounty || !fbCounty) return true
  if (oldCounty === fbCounty) return true
  // Allow "London" vs "Greater London" / "London (Ealing)" etc.
  return oldCounty.includes(fbCounty) || fbCounty.includes(oldCounty)
}

// Normalize station name for comparison: "Leeds (city)" → "leeds", "Hall i' th' Wood" ↔ "Hall-i'-th'-wood"
// " and " and " & " are treated as the same (e.g. "Cam and Dudley" ↔ "Cam & Dudley")
const normalizeStationNameForMatch = (name: string): string => {
  if (!name || typeof name !== 'string') return ''
  const original = name.toLowerCase().trim()
  let s = original
  s = s.replace(/\s+and\s+/g, ' & ') // "cam and dudley" → "cam & dudley"
  s = s.replace(/\s*\([^)]*\)\s*$/g, '') // strip trailing parenthetical e.g. " (city)", " (Ealing)"
  s = s.replace(/-/g, ' ') // hyphens to spaces so "Hall-i'-th'-wood" matches "Hall i' th' Wood"
  s = s.replace(/'/g, '') // strip all apostrophes so "Bishop's Stortford" matches "Bishops Stortford"
  if (original.endsWith("'s")) s = s.replace(/[^s]s$/, (m) => m[0]) // "Bishopton's" → "bishopton"
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

// Extract trailing parenthetical qualifier for disambiguation: "Dalston (Kingsland)" → "kingsland"
const getTrailingParentheticalQualifier = (name: string): string => {
  if (!name || typeof name !== 'string') return ''
  const m = name.trim().match(/\s*\(([^)]*)\)\s*$/)
  return m ? m[1].toLowerCase().trim() : ''
}

// Find the best match for a station
const findBestMatch = (oldStation: OldFormatStation, firebaseStations: FirebaseStationLike[]): StationMatch => {
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
  const normalizedStationName = normalizeStationNameForMatch(oldStation.stationName)
  const oldCountry = (oldStation.country || '').toLowerCase().trim()
  const oldCounty = (oldStation.county || '').toLowerCase().trim()
  const oldTOC = (oldStation.operator || '').toLowerCase().trim()
  const oldLat = parseFloat(oldStation.latitude)
  const oldLng = parseFloat(oldStation.longitude)
  // Treat missing, null, or (0,0) as "no coordinates" – don't use for distance or coordinate matching
  const hasValidCoords =
    !isNaN(oldLat) && !isNaN(oldLng) && (oldLat !== 0 || oldLng !== 0)

  let bestMatch: FirebaseStationLike | null = null
  let matchType: 'exact' | 'fuzzy' | 'coordinates' | 'none' = 'none'
  let confidence = 0
  let suggestedId = generateId()
  let suggestedCrsCode = ''
  let suggestedTiploc = ''

  // 1. Try exact name match – literal or normalized (Leeds vs Leeds (city), Bishopton vs Bishopton's)
  // When CSV normalizes to a single word (e.g. "Dalston"), also include FB stations that start with that word (e.g. "Dalston Junction")
  // so we can disambiguate by coordinates (London "Dalston" → Dalston Junction, Cumbria → Dalston (Cumbria))
  const exactMatches: FirebaseStationLike[] = []
  const csvNameIsSingleWord = normalizedStationName.length > 0 && !normalizedStationName.includes(' ')
  for (const fbStation of firebaseStations) {
    const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
    if (typeof fbNameRaw !== 'string') continue
    const fbName = fbNameRaw.toLowerCase().trim()
    const normalizedFb = normalizeStationNameForMatch(fbNameRaw)
    const literalMatch = fbName === stationName
    const normalizedMatch = normalizedStationName && normalizedFb === normalizedStationName
    const csvSingleWordPrefixMatch =
      csvNameIsSingleWord && normalizedFb.startsWith(normalizedStationName + ' ')
    if (literalMatch || normalizedMatch || csvSingleWordPrefixMatch) {
      exactMatches.push(fbStation)
    }
  }
  // When CSV has a (placename) qualifier, only allow candidates that contain that qualifier – avoids e.g. all 3 Whitchurches matching to one
  const qualifier = getTrailingParentheticalQualifier(oldStation.stationName)
  let candidates: FirebaseStationLike[] = exactMatches
  if (qualifier) {
    candidates = exactMatches.filter((fb) => {
      const raw = (fb.stationName || fb.stationname || '').toLowerCase()
      return raw.includes(qualifier)
    })
  }
  if (candidates.length === 1) {
    bestMatch = candidates[0]
    matchType = 'exact'
    confidence = 1.0
    suggestedId = bestMatch.id || suggestedId
    suggestedCrsCode = bestMatch.crsCode || bestMatch.CrsCode || ''
    suggestedTiploc = bestMatch.tiploc || ''
  } else if (candidates.length > 1) {
    // Prefer the candidate that contains the qualifier within reasonable distance – else pick by coords
    const MAX_QUALIFIER_DISTANCE_KM = 30
    if (qualifier && hasValidCoords) {
      const byQualifier = candidates.find((fb) => {
        const raw = (fb.stationName || fb.stationname || '').toLowerCase()
        return raw.includes(qualifier)
      })
      if (byQualifier && typeof byQualifier.latitude === 'number' && typeof byQualifier.longitude === 'number') {
        const distKm = calculateDistance(oldLat, oldLng, byQualifier.latitude, byQualifier.longitude)
        if (distKm <= MAX_QUALIFIER_DISTANCE_KM) {
          bestMatch = byQualifier
        }
      }
    }
    if (!bestMatch) {
      const withCoords = candidates.filter(
        (fb) => typeof fb.latitude === 'number' && typeof fb.longitude === 'number' &&
          !isNaN(fb.latitude) && !isNaN(fb.longitude) && (fb.latitude !== 0 || fb.longitude !== 0)
      )
      if (hasValidCoords && withCoords.length > 0) {
        let closest = withCoords[0]
        let minDist = Infinity
        for (const fb of withCoords) {
          const d = calculateDistance(oldLat, oldLng, fb.latitude, fb.longitude)
          if (d < minDist) {
            minDist = d
            closest = fb
          }
        }
        bestMatch = closest
      } else {
        bestMatch = candidates[0]
      }
    }
    if (bestMatch) {
      matchType = 'exact'
      confidence = 1.0
      suggestedId = bestMatch.id || suggestedId
      suggestedCrsCode = bestMatch.crsCode || bestMatch.CrsCode || ''
      suggestedTiploc = bestMatch.tiploc || ''
    }
  }

  // 2. Try fuzzy name match (strict threshold to avoid e.g. "Acton Bridge" → "Haydon Bridge")
  const FUZZY_MIN_SIMILARITY = 0.82
  const nameForFuzzy = (n: string) => n.replace(/\s+and\s+/g, ' & ')
  if (!bestMatch) {
    for (const fbStation of firebaseStations) {
      const fbCountry = (fbStation.country || '').toLowerCase().trim()
      const fbCounty = (fbStation.county || '').toLowerCase().trim()
      if (!countryCountyCompatible(oldCountry, oldCounty, fbCountry, fbCounty)) continue
      const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
      if (typeof fbNameRaw !== 'string') continue
      const fbName = fbNameRaw.toLowerCase().trim()
      const similarity = calculateSimilarity(nameForFuzzy(stationName), nameForFuzzy(fbName))
      if (similarity < FUZZY_MIN_SIMILARITY) continue
      // Require first word to match for multi-word names (avoids Acton vs Haydon)
      const oldWords = stationName.split(/\s+/)
      const fbWords = fbName.split(/\s+/)
      if (oldWords.length > 1 && fbWords.length > 1 && oldWords[0] !== fbWords[0]) continue
      let matchConfidence = similarity
      if (oldCountry && fbCountry && fbCountry === oldCountry) matchConfidence += 0.2
      if (oldCounty && fbCounty && fbCounty === oldCounty) matchConfidence += 0.15
      const fbTOC = (fbStation.toc || fbStation.TOC || '').toLowerCase().trim()
      if (oldTOC && fbTOC && fbTOC === oldTOC) matchConfidence += 0.1
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

  // 3. Try coordinate match if no name match (skip when lat/long missing, 0, or null)
  if (!bestMatch && hasValidCoords) {
    for (const fbStation of firebaseStations) {
      const fbCountry = (fbStation.country || '').toLowerCase().trim()
      const fbCounty = (fbStation.county || '').toLowerCase().trim()
      if (!countryCountyCompatible(oldCountry, oldCounty, fbCountry, fbCounty)) continue
      const fbLat = fbStation.latitude
      const fbLng = fbStation.longitude
      if (!fbLat || !fbLng) continue
      const distance = calculateDistance(oldLat, oldLng, fbLat, fbLng)
      if (distance >= 0.5) continue
      const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
      const fbName = (typeof fbNameRaw === 'string' ? fbNameRaw : '').toLowerCase().trim()
      const nameSimilarity = fbName ? calculateSimilarity(stationName, fbName) : 0
      if (nameSimilarity < 0.4) continue // Don't assign a totally different name by coords alone
      let coordConfidence = Math.max(0.3, 1 - (distance * 2))
      if (oldCountry && fbCountry && fbCountry === oldCountry) coordConfidence += 0.2
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

  // 4. Try partial name match (contains) as last resort – require good similarity and country/county compatible
  // Require the shorter (contained) name to have at least two words so we don't match "Dalston" → "Dalston (Cumbria)"
  // or allow single-word prefix matches that could be wrong (e.g. multiple "Dalston" stations).
  if (!bestMatch) {
    for (const fbStation of firebaseStations) {
      const fbCountry = (fbStation.country || '').toLowerCase().trim()
      const fbCounty = (fbStation.county || '').toLowerCase().trim()
      if (!countryCountyCompatible(oldCountry, oldCounty, fbCountry, fbCounty)) continue
      const fbNameRaw = fbStation.stationName || fbStation.stationname || ''
      if (typeof fbNameRaw !== 'string') continue
      const fbName = fbNameRaw.toLowerCase().trim()
      const minLen = Math.min(stationName.length, fbName.length)
      if (minLen <= 3) continue
      const contains = stationName.includes(fbName) || fbName.includes(stationName)
      if (!contains) continue
      const shorterName = stationName.length <= fbName.length ? stationName : fbName
      if (!shorterName.includes(' ')) continue // avoid single-word contained match (e.g. "dalston" in "dalston (cumbria)")
      const similarity = calculateSimilarity(stationName, fbName)
      if (similarity < 0.65) continue // Avoid "X Bridge" matching wrong "Y Bridge"
      let partialConfidence = 0.4
      if (oldCountry && fbCountry && fbCountry === oldCountry) partialConfidence += 0.3
      if (oldCounty && fbCounty && fbCounty === oldCounty) partialConfidence += 0.2
      const fbTOC = (fbStation.toc || fbStation.TOC || '').toLowerCase().trim()
      if (oldTOC && fbTOC && fbTOC === oldTOC) partialConfidence += 0.1
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
  } catch {
    // If parsing fails, return the original string
  }
  
  // Return original string if no pattern matches
  return dateString
}

// Convert new stations from database to new format (use Firebase IDs)
const convertNewStationsToFormat = (newStations: FirebaseStationLike[]): NewFormatStation[] => {
  const converted: NewFormatStation[] = []
  
  for (let i = 0; i < newStations.length; i++) {
    const station = newStations[i]
    const stationId = station.id != null ? String(station.id) : String(i + 1).padStart(4, '0')
    
    const newStation: NewFormatStation = {
      id: stationId,
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
    if (station.yearlyPassengers && typeof station.yearlyPassengers === 'object') {
      for (let year = 2024; year >= 1998; year--) {
        const yearStr = year.toString()
        const v = (station.yearlyPassengers as Record<string, number | null>)[yearStr]
        newStation[yearStr] = typeof v === 'number' ? v : 0
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
export const convertToNewFormat = (matches: StationMatch[], newStations: FirebaseStationLike[] = []): NewFormatStation[] => {
  const converted: NewFormatStation[] = []
  let unmatchedIndex = 0

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const old = match.oldStation
    const firebase = match.firebaseStation

    // Matched (or user-corrected): use Firebase ID. Unmatched: use 9xxx (9001, 9002, ...)
    const firebaseId = firebase && (firebase.id ?? match.suggestedId ?? '')
    const hasMatch = firebase && (String(firebaseId).trim() !== '')
    let outputId: string
    if (hasMatch) {
      outputId = String(firebaseId).trim()
    } else {
      unmatchedIndex += 1
      outputId = String(9000 + unmatchedIndex)
    }
    
    // Use matched station data when available, otherwise use old data
    const newStation: NewFormatStation = {
      id: outputId,
      stnarea: 'GBNR',
      // Use matched station name if available, otherwise use old station name
      stationname: firebase ? (firebase.stationName || firebase.stationname || old.stationName) : old.stationName,
      CrsCode: match.suggestedCrsCode,
      tiploc: match.suggestedTiploc,
      // Use matched station location data if available, otherwise use old data
      country: firebase ? (firebase.country || old.country) : old.country,
      county: firebase ? (firebase.county || old.county) : old.county,
      TOC: firebase ? (firebase.toc || firebase.TOC || old.operator) : old.operator,
      // Use old coordinates when present; use 0 when missing, null, or invalid so JSON is valid
      location: JSON.stringify({
        _latitude: safeLatLng(old.latitude),
        _longitude: safeLatLng(old.longitude)
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
    const newStationsConverted = convertNewStationsToFormat(newStations)
    converted.push(...newStationsConverted)
    console.log(`Added ${newStationsConverted.length} new stations (ID >= 2588) to converted output`)
  }

  return converted
}

// Generate migration result with country filtering
export const generateMigrationResult = (
  matches: StationMatch[], 
  rejectedStations: OldFormatStation[] = [],
  availableStations: FirebaseStationLike[] = []
): MigrationResult => {
  const unmatched = matches.filter(m => m.matchType === 'none').map(m => m.oldStation)
  
  // Find stations in database that were not matched (untracked stations)
  const matchedStationIds = new Set(
    matches
      .map((m) => m.firebaseStation?.id)
      .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
  )
  
  const untrackedStations = availableStations.filter(
    station => !matchedStationIds.has(station.id)
  )
  
  // Also find new stations (ID 2588 and above) that are likely not in CSV
  const newStations = availableStations.filter(station => {
    const stationIdRaw = station.id
    const stationId = parseInt(stationIdRaw, 10)
    return !isNaN(stationId) && stationId >= 2588 && !matchedStationIds.has(stationIdRaw)
  })
  
  console.log(`Found ${untrackedStations.length} untracked stations (in database but not in CSV)`)
  console.log(`Found ${newStations.length} new stations (ID >= 2588)`)
  
  // Convert matches and automatically add new stations
  const converted = convertToNewFormat(matches, newStations)

  // Duplicate detection: same output ID on more than one row; also build outputIds[] for prev/next in UI
  let unmatchedIndex = 0
  const outputIds: string[] = []
  const idToIndices: Record<string, number[]> = {}
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const firebase = m.firebaseStation
    const hasMatch = firebase && (String(firebase.id ?? m.suggestedId ?? '').trim() !== '')
    const outputId = hasMatch
      ? String(firebase!.id ?? m.suggestedId).trim()
      : String(9000 + (++unmatchedIndex))
    outputIds.push(outputId)
    if (!idToIndices[outputId]) idToIndices[outputId] = []
    idToIndices[outputId].push(i)
  }
  const duplicateGroups: MigrationResult['duplicateGroups'] = Object.entries(idToIndices)
    .filter(([, indices]) => indices.length > 1)
    .map(([id, matchIndices]) => ({
      id,
      matchIndices,
      stationNames: matchIndices.map((idx) => matches[idx].oldStation.stationName || '')
    }))

  // Mis-matched detection: fuzzy with low confidence, or CSV had (placename) but matched station doesn't contain it.
  // Skip manual/corrected rows — the user explicitly chose that station, so it is not a "possible mis-match".
  const mismatchedMatchIndices: number[] = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (!m.firebaseStation) continue
    if (m.matchType === 'manual') continue
    const qualifier = getTrailingParentheticalQualifier(m.oldStation.stationName)
    if (qualifier) {
      const fbName = (m.firebaseStation.stationName || m.firebaseStation.stationname || '').toLowerCase()
      if (!fbName.includes(qualifier)) mismatchedMatchIndices.push(i)
    } else if (m.matchType === 'fuzzy' && m.confidence < 0.9) {
      mismatchedMatchIndices.push(i)
    }
  }
  
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
    favorites: favoritesCount,
    duplicateIds: duplicateGroups.length,
    mismatched: mismatchedMatchIndices.length
  }

  return {
    matches,
    unmatched,
    rejected: rejectedStations,
    untracked: untrackedStations,
    newStations: newStations,
    converted,
    availableStations,
    duplicateGroups,
    outputIds,
    mismatchedMatchIndices,
    stats
  }
}

// Download CSV file
export const downloadCSV = (data: NewFormatStation[], filename: string = 'converted-stations.csv'): void => {
  if (data.length === 0) {
    alert('No data to download')
    return
  }

  // Column order for export (station usage / year columns excluded)
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

  const csvContent = [
    orderedHeaders.join(','),
    ...data.map(row =>
      orderedHeaders.map(header => {
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