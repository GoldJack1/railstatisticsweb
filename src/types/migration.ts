// Migration types for CSV conversion

export interface OldFormatStation {
  type?: string // Optional, only in Format 2 (e.g., "GBNationalRail")
  stationName: string
  country: string
  county: string
  operator: string
  visited: string
  visitDate: string
  favorite: string
  latitude: string
  longitude: string
  [year: string]: string | undefined // Dynamic year columns (2024, 2023, etc.) - undefined for optional properties
}

export interface NewFormatStation {
  id: string
  stnarea: string
  stationname: string
  CrsCode: string
  tiploc: string
  country: string
  county: string
  TOC: string
  location: string // JSON string with latitude/longitude
  'Is Visited': string
  'Visit Dates': string
  'Is Favorite': string
  [year: string]: string | number // Dynamic year columns (2024, 2023, etc.)
}

export interface StationMatch {
  oldStation: OldFormatStation
  firebaseStation: any | null
  matchType: 'exact' | 'fuzzy' | 'coordinates' | 'manual' | 'none'
  confidence: number
  suggestedId: string
  suggestedCrsCode: string
  suggestedTiploc: string
}

export interface MigrationResult {
  matches: StationMatch[]
  unmatched: OldFormatStation[]
  rejected: OldFormatStation[]
  converted: NewFormatStation[]
  stats: {
    total: number
    matched: number
    unmatched: number
    rejected: number
    exactMatches: number
    fuzzyMatches: number
    coordinateMatches: number
    visited: number
    favorites: number
  }
}

export interface MigrationState {
  file: File | null
  oldFormatData: OldFormatStation[]
  rejectedStations: OldFormatStation[]
  firebaseStations: any[]
  matches: StationMatch[]
  result: MigrationResult | null
  loading: boolean
  error: string | null
  step: 'upload' | 'matching' | 'review' | 'complete'
  // Search functionality
  searchQuery: string
  searchResults: any[]
  selectedMatchIndex: number | null
  showSearchModal: boolean
  // Progress tracking
  showProgressModal: boolean
  matchingProgress: number
  currentStationName: string
  // Format detection
  detectedFormat: string | null
}
