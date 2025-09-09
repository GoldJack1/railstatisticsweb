// Migration types for CSV conversion

export interface OldFormatStation {
  stationName: string
  country: string
  county: string
  operator: string
  visited: string
  visitDate: string
  favorite: string
  latitude: string
  longitude: string
  [year: string]: string // Dynamic year columns (2024, 2023, etc.)
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
  'Is Visited': boolean
  'Visit Dates': string
  'Is Favorite': boolean
  [year: string]: string | number | boolean // Dynamic year columns (2024, 2023, etc.)
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
  converted: NewFormatStation[]
  stats: {
    total: number
    matched: number
    unmatched: number
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
}
