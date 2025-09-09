
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
  yearlyPassengers: YearlyPassengers | null
}

export interface YearlyPassengers {
  [year: string]: number
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
