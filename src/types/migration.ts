// Migration types for CSV conversion

import type { Station, YearlyPassengers } from './index'

/**
 * Station shape used throughout migration + search.
 * In practice this is the app's `Station` type plus a few legacy field aliases used in CSV tooling.
 */
export type FirebaseStationLike = Station & {
  /** Legacy/alternate field names seen in Firestore/CSV tooling */
  stationname?: string
  CrsCode?: string
  TOC?: string
  /** Passenger stats as stored on some station docs */
  yearlyPassengers?: YearlyPassengers | Record<string, number | null> | null
}

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
  firebaseStation: FirebaseStationLike | null
  matchType: 'exact' | 'fuzzy' | 'coordinates' | 'manual' | 'none'
  confidence: number
  suggestedId: string
  suggestedCrsCode: string
  suggestedTiploc: string
  /** Set when user corrects from the no-match section so the row stays visible there */
  correctedFromNoMatch?: boolean
}

/** One duplicate ID and the match indices + names that share it */
export interface DuplicateGroup {
  id: string
  matchIndices: number[]
  stationNames: string[]
}

/** When the user used Correct — shown on Step 5 “Review changes” */
export type MigrationCorrectionPhase = 'review' | 'duplicates'

export interface MigrationCorrectionLogEntry {
  id: string
  matchIndex: number
  csvStationName: string
  previousMatchType: StationMatch['matchType']
  previousStationId: string
  previousStationLabel: string
  newStationId: string
  newStationLabel: string
  phase: MigrationCorrectionPhase
}

export interface MigrationResult {
  matches: StationMatch[]
  unmatched: OldFormatStation[]
  rejected: OldFormatStation[]
  untracked: FirebaseStationLike[] // Stations in database but not in CSV
  newStations: FirebaseStationLike[] // Stations with ID >= 2588 (new additions to database)
  converted: NewFormatStation[]
  /** Same collection used for matching (so manual-match regeneration uses same list) */
  availableStations: FirebaseStationLike[]
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
  firebaseStations: FirebaseStationLike[]
  matches: StationMatch[]
  result: MigrationResult | null
  loading: boolean
  error: string | null
  step: 'upload' | 'mapping' | 'matching' | 'review' | 'duplicates' | 'reviewChanges' | 'complete'
  // Column mapping (after upload, before matching)
  rawCsvContent: string | null
  rawHeaders: string[]
  rawPreviewRows: string[][]
  columnMapping: ColumnMapping | null
  // Search functionality
  searchQuery: string
  searchResults: FirebaseStationLike[]
  /** Active "Search by" filter: name, crs, tiploc, county, country; null when none */
  searchByField: 'identifiers' | 'county' | 'country' | null
  selectedMatchIndex: number | null
  showSearchModal: boolean
  // Progress tracking
  showProgressModal: boolean
  matchingProgress: number
  currentStationName: string
  /** Step shown in the matching modal */
  matchingPhase: 'idle' | 'loading-db' | 'matching' | 'finalizing'
  matchingIndex: number
  matchingTotal: number
  /** Short line under the title (e.g. “Fetching live station data…”) */
  matchingStatusLine: string
  // Format detection
  detectedFormat: string | null
  /** Number of manual corrections (Correct/search) made this session */
  correctionsCount: number
  /** Snapshot of duplicate groups when entering Step 4 so sections don't disappear after corrections */
  duplicateGroupsSnapshot: DuplicateGroup[] | null
  /** Chronological log of every Correct action (review + duplicate steps) */
  correctionLog: MigrationCorrectionLogEntry[]
}
