import { initializeApp, FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  Auth,
  User
} from 'firebase/auth'
import { getFirestore, collection, doc, getDocs, getDoc, connectFirestoreEmulator, Firestore } from 'firebase/firestore'
import { Analytics } from 'firebase/analytics'
import type { Station } from '../types'

// Firebase configuration from environment variables (set in Netlify or .env.local)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'placeholder',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'placeholder',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'placeholder',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'placeholder',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'placeholder',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'placeholder',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'placeholder',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'placeholder'
}

// Debug logging to verify environment variables are loaded
console.log('🔥 Firebase Config Check:')
console.log('  - API Key:', firebaseConfig.apiKey === 'placeholder' ? '❌ NOT LOADED (using placeholder)' : `✅ Loaded (${firebaseConfig.apiKey.substring(0, 10)}...)`)
console.log('  - Project ID:', firebaseConfig.projectId)
console.log('  - Auth Domain:', firebaseConfig.authDomain)
console.log('  - Environment:', import.meta.env.MODE)
console.log('  - All env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')))

// Initialize Firebase
let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let analytics: Analytics | null = null

export const initializeFirebase = async () => {
  if (app) return { app, auth, db, analytics }
  
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)

    // App Check: protect Firestore in production only. Skipped in dev so localhost works without adding it to reCAPTCHA domains.
    const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY
    const isDev = import.meta.env.DEV
    if (!isDev && appCheckSiteKey && appCheckSiteKey !== 'placeholder') {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      })
      console.log('🔥 Firebase App Check enabled (reCAPTCHA v3)')
    }

    db = getFirestore(app)
    
    // Connect to Firebase emulator in development if explicitly enabled
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      try {
        connectFirestoreEmulator(db, '127.0.0.1', 8080)
        console.log('🔥 Connected to Firebase emulator')
      } catch (emulatorError) {
        console.warn('Firebase emulator connection failed:', (emulatorError as Error).message)
      }
    }
    
    // Initialize analytics (optional, won't fail if blocked)
    try {
      const { getAnalytics } = await import('firebase/analytics')
      analytics = getAnalytics(app)
    } catch {
      // Analytics blocked by ad blockers or not available
      analytics = null
    }
    
    return { app, auth, db, analytics }
  } catch (error) {
    console.error('Firebase initialization failed:', error)
    throw error
  }
}

export const getFirebaseApp = (): FirebaseApp | null => app
export const getFirebaseAuth = (): Auth | null => auth
export const getFirebaseDB = (): Firestore | null => db
export const getFirebaseAnalytics = (): Analytics | null => analytics

// Auth helpers (call after initializeFirebase)
export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth!, email, password)
export const signUpWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth!, email, password)
export const logout = () => firebaseSignOut(auth!)

/** Sign in with Google (popup). Enable Google in Firebase Console → Authentication → Sign-in method and use the Web client ID/secret there. */
export const loginWithGoogle = async () => {
  if (!auth) await initializeFirebase().then(() => {})
  const a = getFirebaseAuth()
  if (!a) throw new Error('Firebase Auth not initialized')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(a, provider)
}

/** Sign in with Apple (popup). Service ID, Team ID, key etc. are configured in Firebase Console → Authentication → Apple. */
export const loginWithApple = async () => {
  if (!auth) await initializeFirebase().then(() => {})
  const a = getFirebaseAuth()
  if (!a) throw new Error('Firebase Auth not initialized')
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  return signInWithPopup(a, provider)
}

export { onAuthStateChanged }
export type { User }

// Production collection only. Sandbox option removed; website always uses stations2603.
export const STATION_COLLECTION_STORAGE_KEY = 'railstats_station_collection'

export type StationCollectionId = 'stations2603' | 'newsandboxstations1'

/** Always returns production collection. Sandbox is no longer selectable. */
export const getStationCollectionName = (): StationCollectionId => {
  return 'stations2603'
}

// Parse location string helper
export const parseLocationString = (locationString: string): { latitude: number; longitude: number } | null => {
  try {
    if (!locationString || typeof locationString !== 'string') {
      return null
    }
    
    // Handle format like "[51.59792249° N, 0.12023522° W]"
    if (locationString.includes('°')) {
      const cleanString = locationString.replace(/[[\]]/g, '')
      const parts = cleanString.split(',')
      
      if (parts.length === 2) {
        const latPart = parts[0].trim()
        const latMatch = latPart.match(/(\d+\.?\d*)\s*°\s*([NS])/i)
        
        const lngPart = parts[1].trim()
        const lngMatch = lngPart.match(/(\d+\.?\d*)\s*°\s*([EW])/i)
        
        if (latMatch && lngMatch) {
          let latitude = parseFloat(latMatch[1])
          let longitude = parseFloat(lngMatch[1])
          
          if (latMatch[2].toUpperCase() === 'S') {
            latitude = -latitude
          }
          if (lngMatch[2].toUpperCase() === 'W') {
            longitude = -longitude
          }
          
          return { latitude, longitude }
        }
      }
    }
    
    // Handle format like "[51.59792249, -0.12023522]"
    if (locationString.startsWith('[') && locationString.endsWith(']')) {
      const cleanString = locationString.replace(/[[\]]/g, '')
      const parts = cleanString.split(',')
      
      if (parts.length === 2) {
        const latitude = parseFloat(parts[0].trim())
        const longitude = parseFloat(parts[1].trim())
        
        if (!isNaN(latitude) && !isNaN(longitude)) {
          return { latitude, longitude }
        }
      }
    }
    
    // Handle format like "51.59792249, -0.12023522"
    if (locationString.includes(',')) {
      const parts = locationString.split(',')
      if (parts.length === 2) {
        const latitude = parseFloat(parts[0].trim())
        const longitude = parseFloat(parts[1].trim())
        
        if (!isNaN(latitude) && !isNaN(longitude)) {
          return { latitude, longitude }
        }
      }
    }
    
    return null
    
  } catch (error) {
    console.error('Error parsing location string:', locationString, error)
    return null
  }
}

// Fetch stations from Firebase (optional collection override so caller can pass dropdown value at click time)
export const fetchStationsFromFirebase = async (collectionOverride?: StationCollectionId): Promise<Station[]> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }

  if (!db) {
    throw new Error('Failed to initialize Firebase database')
  }

  try {
    const collectionName = collectionOverride ?? getStationCollectionName()
    const stationsRef = collection(db, collectionName)
    const snapshot = await getDocs(stationsRef)
    
    const stations: Station[] = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      
      // Extract coordinates from various formats
      let latitude = 0
      let longitude = 0
      let extracted = false
      
      // Method 1: Parse location data (string, array, or object)
      if (data.location) {
        if (typeof data.location === 'string') {
          const coords = parseLocationString(data.location)
          if (coords) {
            latitude = coords.latitude
            longitude = coords.longitude
            extracted = true
          }
        } else if (Array.isArray(data.location) && data.location.length >= 2) {
          const lat = parseFloat(data.location[0])
          const lng = parseFloat(data.location[1])
          
          if (!isNaN(lat) && !isNaN(lng)) {
            latitude = lat
            longitude = lng
            extracted = true
          }
        } else if (typeof data.location === 'object' && data.location !== null) {
          const lat = parseFloat(data.location.latitude || data.location.lat)
          const lng = parseFloat(data.location.longitude || data.location.lng || data.location.lon)
          
          if (!isNaN(lat) && !isNaN(lng)) {
            latitude = lat
            longitude = lng
            extracted = true
          }
        }
      }
      
      // Method 2: Standard latitude/longitude fields
      if (!extracted && data.latitude && data.longitude) {
        if (data.latitude._lat !== undefined && data.longitude._long !== undefined) {
          latitude = data.latitude._lat
          longitude = data.longitude._long
          extracted = true
        } else if (data.latitude.latitude !== undefined && data.longitude.longitude !== undefined) {
          latitude = data.latitude.latitude
          longitude = data.longitude.longitude
          extracted = true
        } else if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          latitude = data.latitude
          longitude = data.longitude
          extracted = true
        } else if (typeof data.latitude === 'object' && typeof data.longitude === 'object') {
          const latValues = Object.values(data.latitude).filter(v => typeof v === 'number')
          const lngValues = Object.values(data.longitude).filter(v => typeof v === 'number')
          
          if (latValues.length > 0 && lngValues.length > 0) {
            latitude = latValues[0]
            longitude = lngValues[0]
            extracted = true
          }
        }
      }
      
      const fareZoneRaw = data.fareZone ?? data.fare_zone ?? data.FareZone ?? data['Fare Zone'] ?? data.farezone
      const fareZone = fareZoneRaw != null && fareZoneRaw !== '' ? String(fareZoneRaw) : null

      let londonBorough: string | null =
        data.londonBorough ??
        data['London Borough'] ??
        data.LondonBorough ??
        data.london_borough ??
        data.borough ??
        data.Borough ??
        null
      if (londonBorough == null && typeof data.address === 'object' && data.address !== null) {
        const addr = data.address as Record<string, unknown>
        const b = addr.borough ?? addr.londonBorough ?? addr['London Borough']
        if (b != null && b !== '') londonBorough = String(b)
      }

      const station = {
        id: doc.id,
        stationName: data.stationname || data.stationName || '',
        crsCode: data.CrsCode || data.crsCode || '',
        tiploc: data.tiploc || null,
        latitude: latitude,
        longitude: longitude,
        country: data.country || null,
        county: data.county || null,
        toc: data.TOC || data.toc || null,
        stnarea: data.stnarea || null,
        londonBorough: londonBorough != null && londonBorough !== '' ? String(londonBorough) : null,
        fareZone,
        yearlyPassengers: data.yearlyPassengers || null
      }
      
      stations.push(station)
    })
    
    return stations
    
  } catch (error) {
    console.error('Firebase fetch error:', error)
    throw error
  }
}

/** Fetch a single station document by ID from the current collection (for sandbox full-detail modal). */
export const fetchStationDocumentById = async (stationId: string): Promise<Record<string, unknown> | null> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }
  if (!db) return null
  try {
    const collectionName = getStationCollectionName()
    const docRef = doc(db, collectionName, stationId)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null
    return snapshot.data() as Record<string, unknown>
  } catch (error) {
    console.error('Firebase fetch station doc error:', error)
    return null
  }
}
