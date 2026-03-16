
// Station data types
export interface Station {
  id: string
  stationName: string
  crsCode: string
  tiploc: string | null
  latitude: number
  longitude: number
  country: string | null
  county: string | null
  toc: string | null
  stnarea: string | null
  /** London borough (e.g. Greater London stations) */
  londonBorough?: string | null
  /** Fare zone (e.g. 1, 2, 3 for TfL) */
  fareZone?: string | null
  yearlyPassengers: YearlyPassengers | null
}

export interface YearlyPassengers {
  [year: string]: number | null
}

/** Sandbox collection (newsandboxstations1) full document shape for modal detail view */
export interface SandboxStationDoc {
  id?: string
  location?: unknown
  stnarea?: string
  stationname?: string
  CrsCode?: string
  tiploc?: string
  country?: string
  county?: string
  TOC?: string
  operatorCode?: string
  staffingLevel?: string
  nlc?: string
  'min-connection-time'?: string | number
  urlSlug?: string
  toilets?: {
    toiletsAccessible?: string
    toiletsChangingPlace?: string
    toiletsBabyChanging?: string
  }
  stepFree?: {
    stepFreeCode?: string
    stepFreeNote?: string
  }
  lift?: {
    liftAvailable?: string
    liftNotes?: string
    liftDetails?: string
  }
  connections?: {
    connectionBus?: string
    connectionTaxi?: string
    connectionUnderground?: string
  }
  is?: {
    isrequeststop?: string | boolean
    Islimitedservice?: string | boolean
  }
  facilities?: Record<string, unknown>
  yearlyPassengers?: Record<string, number | null>
  londonBorough?: string
  fareZone?: string | number
}

export interface StationStats {
  totalStations: number
  withCoordinates: number
  withTOC: number
  withPassengers: number
}

// Firebase types
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId: string
}

// Theme types
export type Theme = 'light' | 'dark'

// Hook return types
export interface UseStationsReturn {
  stations: Station[]
  loading: boolean
  error: string | null
  stats: StationStats
  refetch: () => void
}

export interface UseThemeReturn {
  theme: Theme
  toggleTheme: () => void
}
