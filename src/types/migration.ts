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

/** One duplicate ID and the match indices + names that share it */
export interface DuplicateGroup {
  id: string
  matchIndices: number[]
  stationNames: string[]
}

export interface MigrationResult {
  matches: StationMatch[]
  unmatched: OldFormatStation[]
  rejected: OldFormatStation[]
  untracked: any[] // Stations in database but not in CSV
  newStations: any[] // Stations with ID >= 2588 (new additions to database)
  converted: NewFormatStation[]
  /** Same collection used for matching (so manual-match regeneration uses same list) */
  availableStations: any[]
  /** Output IDs that appear on more than one row; use Correct to assign a different station */
  duplicateGroups: DuplicateGroup[]
  /** Output ID per match index (so UI can show prev/next ID for duplicate rows) */
  outputIds: string[]
  stats: {
    total: number
    matched: number
    unmatched: number
    rejected: number
    untracked: number
    newStations: number
    exactMatches: number
    fuzzyMatches: number
    coordinateMatches: number
    visited: number
    favorites: number
    /** Number of output IDs that are duplicated (same ID on multiple rows) */
    duplicateIds: number
    /** Possible wrong matches (fuzzy with low confidence or qualifier mismatch) */
    mismatched: number
  }
  /** Match indices to review as possible mis-matches (fuzzy low confidence or qualifier mismatch) */
  mismatchedMatchIndices: number[]
}

/** User-chosen mapping: key = our field, value = CSV column header name */
export interface ColumnMapping {
  stationName: string
  country: string
  county: string
  operator: string
  visited: string
  visitDate: string
  favorite: string
  latitude: string
  longitude: string
  /** If set, use this column as JSON for lat/long and ignore latitude/longitude columns */
  location?: string
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
  step: 'upload' | 'mapping' | 'matching' | 'review' | 'duplicates' | 'complete'
  // Column mapping (after upload, before matching)
  rawCsvContent: string | null
  rawHeaders: string[]
  rawPreviewRows: string[][]
  columnMapping: ColumnMapping | null
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
  /** Number of manual corrections (Correct/search) made this session */
  correctionsCount: number
}
