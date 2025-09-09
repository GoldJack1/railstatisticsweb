import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, connectFirestoreEmulator } from 'firebase/firestore'

// Firebase configuration from environment variables (set in Netlify)
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

// Initialize Firebase
let app = null
let db = null
let analytics = null

export const initializeFirebase = async () => {
  if (app) return { app, db, analytics }
  
  try {
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    
    // Connect to Firebase emulator in development if explicitly enabled
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      try {
        connectFirestoreEmulator(db, '127.0.0.1', 8080)
        console.log('🔥 Connected to Firebase emulator')
      } catch (emulatorError) {
        console.warn('Firebase emulator connection failed:', emulatorError.message)
      }
    }
    
    // Initialize analytics (optional, won't fail if blocked)
    try {
      const { getAnalytics } = await import('firebase/analytics')
      analytics = getAnalytics(app)
    } catch (analyticsError) {
      // Analytics blocked by ad blockers or not available
      analytics = null
    }
    
    return { app, db, analytics }
  } catch (error) {
    console.error('Firebase initialization failed:', error)
    throw error
  }
}

export const getFirebaseApp = () => app
export const getFirebaseDB = () => db
export const getFirebaseAnalytics = () => analytics

// Parse location string helper
export const parseLocationString = (locationString) => {
  try {
    if (!locationString || typeof locationString !== 'string') {
      return null
    }
    
    // Handle format like "[51.59792249° N, 0.12023522° W]"
    if (locationString.includes('°')) {
      const cleanString = locationString.replace(/[\[\]]/g, '')
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
      const cleanString = locationString.replace(/[\[\]]/g, '')
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

// Fetch stations from Firebase
export const fetchStationsFromFirebase = async () => {
  if (!db) {
    const { db: newDb } = await initializeFirebase()
    db = newDb
  }

  try {
    const stationsRef = collection(db, 'stations')
    const snapshot = await getDocs(stationsRef)
    
    const stations = []
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
