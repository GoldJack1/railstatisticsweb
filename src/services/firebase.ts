import { initializeApp, FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  GoogleAuthProvider,
  OAuthProvider,
  Auth,
  User
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  GeoPoint,
  connectFirestoreEmulator,
  Firestore,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore'
import { Analytics } from 'firebase/analytics'
import type { Station } from '../types'
import type { SandboxStationDoc } from '../types'

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

const isPlaceholder = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '' || value === 'placeholder'

/**
 * In local development we want to fail fast if Firebase env vars
 * are missing, rather than silently using placeholder config.
 */
const validateFirebaseConfigForDev = (): void => {
  if (!import.meta.env.DEV) return

  const missing: string[] = []
  if (isPlaceholder(firebaseConfig.apiKey)) missing.push('VITE_FIREBASE_API_KEY')
  if (isPlaceholder(firebaseConfig.authDomain)) missing.push('VITE_FIREBASE_AUTH_DOMAIN')
  if (isPlaceholder(firebaseConfig.projectId)) missing.push('VITE_FIREBASE_PROJECT_ID')
  if (isPlaceholder(firebaseConfig.appId)) missing.push('VITE_FIREBASE_APP_ID')

  if (missing.length > 0) {
    throw new Error(
      `Firebase env vars missing: ${missing.join(
        ', '
      )}. Create a \`.env.local\` (copy from \`.env.example\`) and restart the dev server.`
    )
  }
}

// Avoid logging config in production (reduces noise and env surface in DevTools).
if (import.meta.env.DEV) {
  console.log('🔥 Firebase Config Check:')
  console.log(
    '  - API Key:',
    firebaseConfig.apiKey === 'placeholder' ? '❌ NOT LOADED (using placeholder)' : '✅ Loaded (redacted)'
  )
  console.log('  - Project ID:', firebaseConfig.projectId)
  console.log('  - Auth Domain:', firebaseConfig.authDomain)
  console.log('  - Environment:', import.meta.env.MODE)
  console.log('  - VITE_* keys:', Object.keys(import.meta.env).filter((k) => k.startsWith('VITE_')))
}

// Initialize Firebase
let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let analytics: Analytics | null = null

export const initializeFirebase = async () => {
  if (app) return { app, auth, db, analytics }
  
  try {
    validateFirebaseConfigForDev()
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)

    // App Check: optional in prod. If Firebase Console enforces App Check on *Authentication*, this build must
    // initialize with the correct reCAPTCHA v3 site key or some Auth calls can fail.
    const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY
    const appCheckExplicitlyDisabled = import.meta.env.VITE_FIREBASE_APP_CHECK_DISABLED === 'true'
    const isDev = import.meta.env.DEV
    const canEnableAppCheck =
      !isDev && !appCheckExplicitlyDisabled && !!appCheckSiteKey && appCheckSiteKey !== 'placeholder'

    if (canEnableAppCheck) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      })
      console.log('🔥 Firebase App Check enabled (reCAPTCHA v3)')
    } else if (!isDev && appCheckExplicitlyDisabled) {
      console.warn(
        '🔥 VITE_FIREBASE_APP_CHECK_DISABLED=true — App Check is off in this build. ' +
          'If Firebase still enforces App Check on Authentication, sign-in may fail until you use Monitoring (not enforce) or remove this flag and set a valid VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY.'
      )
    } else if (!isDev && (!appCheckSiteKey || appCheckSiteKey === 'placeholder')) {
      console.warn(
        '🔥 No VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY in this production build. ' +
          'If App Check enforcement is ON for Authentication in Firebase Console, add the reCAPTCHA v3 site key from App Check → your web app, or turn enforcement to Monitoring.'
      )
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

/**
 * Dev only: if `VITE_LOCAL_AUTH_EMAIL` and `VITE_LOCAL_AUTH_PASSWORD` are set in `.env.local`,
 * sign in with Firebase Email/Password before the rest of auth init (so Firestore + scheduled publish work).
 * Never commit real credentials; use only in local `.env.local`.
 */
export const tryDevAutoSignInFromEnv = async (): Promise<void> => {
  if (import.meta.env.DEV !== true) return
  const email = import.meta.env.VITE_LOCAL_AUTH_EMAIL?.trim()
  const password = import.meta.env.VITE_LOCAL_AUTH_PASSWORD
  if (!email || typeof password !== 'string' || password.length === 0) return
  if (!auth) {
    await initializeFirebase()
  }
  const a = getFirebaseAuth()
  if (!a || a.currentUser) return
  try {
    await signInWithEmailAndPassword(a, email, password)
    console.log('[Rail Statistics][dev] Signed in with Email/Password from VITE_LOCAL_AUTH_*')
  } catch (e) {
    console.warn('[Rail Statistics][dev] VITE_LOCAL_AUTH_* sign-in failed:', e)
  }
}

// Auth helpers (call after initializeFirebase)
export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth!, email, password)
export const logout = () => firebaseSignOut(auth!)

/** Send Firebase email verification (required for verified-email gates in this app). */
export const sendUserEmailVerification = (user: User) => sendEmailVerification(user)

/** Sign in with Google. Uses redirect (no popup) so it works when popups are blocked. */
export const loginWithGoogle = async () => {
  if (!auth) await initializeFirebase().then(() => {})
  const a = getFirebaseAuth()
  if (!a) throw new Error('Firebase Auth not initialized')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithRedirect(a, provider)
  // Page will navigate away to Google; after sign-in user returns and getRedirectResult() runs on load
}

/** Sign in with Apple. Uses redirect (no popup) so it works when popups are blocked. */
export const loginWithApple = async () => {
  if (!auth) await initializeFirebase().then(() => {})
  const a = getFirebaseAuth()
  if (!a) throw new Error('Firebase Auth not initialized')
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  await signInWithRedirect(a, provider)
  // Page will navigate away to Apple; after sign-in user returns and getRedirectResult() runs on load
}

/** Call once on app load to complete sign-in after returning from Google/Apple redirect. */
export const handleRedirectResult = async () => {
  const a = getFirebaseAuth()
  if (!a) return null
  return getRedirectResult(a)
}

export { onAuthStateChanged, getRedirectResult }
export type { User }

export const STATION_COLLECTION_STORAGE_KEY = 'railstats_station_collection'

export type StationCollectionId = 'stations2603' | 'newsandboxstations1'

const DEFAULT_STATION_COLLECTION: StationCollectionId = 'stations2603'

/** Read the currently selected station collection from localStorage (falls back to production). */
export const getStationCollectionName = (): StationCollectionId => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_STATION_COLLECTION
  }
  try {
    const stored = window.localStorage.getItem(STATION_COLLECTION_STORAGE_KEY)
    if (stored === 'stations2603' || stored === 'newsandboxstations1') {
      return stored
    }
  } catch {
    // Ignore storage errors and fall back to default
  }
  return DEFAULT_STATION_COLLECTION
}

/** Persist the selected station collection to localStorage so it can be read by Firebase helpers. */
export const setStationCollectionName = (id: StationCollectionId): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STATION_COLLECTION_STORAGE_KEY, id)
  } catch {
    // Ignore storage errors; selection just won't persist
  }
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

/**
 * Map our Station type to Firestore document fields (same names as used when reading).
 * Only includes fields that are provided (non-undefined).
 */
const stationToFirestoreUpdate = (data: Partial<Station>): Record<string, unknown> => {
  const update: Record<string, unknown> = {}
  if (data.stationName !== undefined) update.stationname = data.stationName
  if (data.crsCode !== undefined) update.CrsCode = data.crsCode
  if (data.tiploc !== undefined) update.tiploc = data.tiploc
  if (data.country !== undefined) update.country = data.country
  if (data.county !== undefined) update.county = data.county
  if (data.toc !== undefined) update.TOC = data.toc
  if (data.stnarea !== undefined) update.stnarea = data.stnarea
  if (data.londonBorough !== undefined) update.londonBorough = data.londonBorough
  if (data.fareZone !== undefined) update.fareZone = data.fareZone
  if (data.yearlyPassengers !== undefined) update.yearlyPassengers = data.yearlyPassengers
  if (data.latitude !== undefined && data.longitude !== undefined) {
    update.location = new GeoPoint(data.latitude, data.longitude)
  }
  return update
}

/** Update a station document in Firestore. Uses current collection (stations2603). */
export const updateStationInFirebase = async (
  stationId: string,
  data: Partial<Station>
): Promise<void> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }
  if (!db) throw new Error('Failed to initialize Firebase database')
  const collectionName = getStationCollectionName()
  const docRef = doc(db, collectionName, stationId)
  const update = stationToFirestoreUpdate(data)
  if (Object.keys(update).length === 0) return
  await updateDoc(docRef, { ...update, id: stationId })
}

/** Create a new station document in Firestore with a specific ID. Uses current collection selection. */
export const createStationInFirebase = async (
  stationId: string,
  data: Partial<Station>
): Promise<void> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }
  if (!db) throw new Error('Failed to initialize Firebase database')
  const collectionName = getStationCollectionName()
  const docRef = doc(db, collectionName, stationId)
  const payload = stationToFirestoreUpdate(data)
  if (Object.keys(payload).length === 0) {
    throw new Error('No data provided to create station')
  }
  await setDoc(docRef, { ...payload, id: stationId })
}

/**
 * Update "additional details" fields on a station document.
 * This intentionally accepts a partial raw document shape so we can write nested sections
 * like toilets/lift/stepFree/facilities as-is.
 */
export const updateStationAdditionalDetailsInFirebase = async (
  stationId: string,
  data: Partial<SandboxStationDoc>
): Promise<void> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }
  if (!db) throw new Error('Failed to initialize Firebase database')
  const collectionName = getStationCollectionName()
  const docRef = doc(db, collectionName, stationId)
  const payload = data as Record<string, unknown>
  if (!payload || Object.keys(payload).length === 0) return
  await updateDoc(docRef, payload)
}

/** Create/merge additional details for a station document (safe for new stations). */
export const mergeStationAdditionalDetailsInFirebase = async (
  stationId: string,
  data: Partial<SandboxStationDoc>
): Promise<void> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }
  if (!db) throw new Error('Failed to initialize Firebase database')
  const collectionName = getStationCollectionName()
  const docRef = doc(db, collectionName, stationId)
  const payload = data as Record<string, unknown>
  if (!payload || Object.keys(payload).length === 0) return
  await setDoc(docRef, payload, { merge: true })
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

/** Firestore collection processed by Cloud Function `processScheduledStationPublishJobs`. */
export const SCHEDULED_STATION_PUBLISH_JOBS_COLLECTION = 'scheduledStationPublishJobs'

function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T
  }
  const out = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = stripUndefinedDeep(v)
  }
  return out as T
}

/**
 * Create a server-side scheduled publish job (Firestore + Cloud Scheduler function).
 * Requires an authenticated user.
 */
export const createScheduledStationPublishJob = async (params: {
  runAtMs: number
  collectionId: StationCollectionId
  changes: Record<
    string,
    {
      isNew?: boolean
      updated: Partial<Station>
      sandboxUpdated?: Partial<SandboxStationDoc> | null
    }
  >
}): Promise<string> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }
  if (!db) throw new Error('Failed to initialize Firebase database')

  const authInstance = getFirebaseAuth()
  if (!authInstance) throw new Error('Firebase Auth not initialized')
  const user = authInstance.currentUser
  if (!user) {
    throw new Error('You must be signed in to schedule a publish.')
  }

  const keys = Object.keys(params.changes)
  if (keys.length === 0) throw new Error('No pending changes to schedule')

  const col = collection(db, SCHEDULED_STATION_PUBLISH_JOBS_COLLECTION)
  const docRef = await addDoc(col, {
    createdAt: serverTimestamp(),
    runAt: Timestamp.fromMillis(params.runAtMs),
    collectionId: params.collectionId,
    createdByUid: user.uid,
    status: 'pending',
    changes: stripUndefinedDeep(params.changes),
    stationIds: keys
  })
  return docRef.id
}

export const deleteScheduledStationPublishJobDocument = async (jobId: string): Promise<void> => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }
  if (!db) throw new Error('Failed to initialize Firebase database')
  await deleteDoc(doc(db, SCHEDULED_STATION_PUBLISH_JOBS_COLLECTION, jobId))
}
