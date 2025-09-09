// Firebase shared module
class FirebaseService {
    constructor() {
        this.db = null;
        this.collection = null;
        this.getDocs = null;
        this.analytics = null;
        this.isInitialized = false;
        this.useLocalDataOnly = false;
    }

    checkLocalDataFlag() {
        // Check URL parameters for local data flag
        const urlParams = new URLSearchParams(window.location.search);
        const localFlag = urlParams.get('local') || urlParams.get('localData');
        
        // Check for localStorage flag
        const localStorageFlag = localStorage.getItem('useLocalDataOnly');
        
        // Check for environment variable (for development)
        const envFlag = window.USE_LOCAL_DATA_ONLY;
        
        this.useLocalDataOnly = localFlag === 'true' || localStorageFlag === 'true' || envFlag === true;
        
        if (this.useLocalDataOnly) {
            console.log('🏠 Local data mode enabled - skipping Firebase initialization');
            console.log('   URL param ?local=true or ?localData=true');
            console.log('   localStorage: useLocalDataOnly=true');
            console.log('   Environment: USE_LOCAL_DATA_ONLY=true');
        }
        
        return this.useLocalDataOnly;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        // Check if we should use local data only
        if (this.checkLocalDataFlag()) {
            this.isInitialized = true;
            console.log('✅ Firebase service initialized in local-only mode');
            return;
        }

        try {
            console.log('Starting Firebase initialization...');
            
            const firebaseConfig = await this.getFirebaseConfig();
            console.log('Firebase config loaded:', {
                apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'missing',
                projectId: firebaseConfig.projectId || 'missing',
                authDomain: firebaseConfig.authDomain || 'missing'
            });
            
            // Import Firebase modules dynamically
            console.log('Importing Firebase modules...');
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js');
            const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js');
            const { getAnalytics } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js');
            console.log('Firebase modules imported successfully');
            
            // Initialize Firebase
            console.log('Initializing Firebase app...');
            const app = initializeApp(firebaseConfig);
            console.log('Firebase app initialized:', app);
            
            console.log('Initializing Firestore...');
            this.db = getFirestore(app);
            this.collection = collection;
            this.getDocs = getDocs;
            console.log('Firestore database initialized:', this.db);
            
            console.log('Initializing Analytics...');
            this.analytics = getAnalytics(app);
            console.log('Analytics initialized:', this.analytics);
            
            this.isInitialized = true;
            console.log('Firebase initialized successfully');
            
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            console.error('Firebase initialization error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            throw error;
        }
    }

    async getFirebaseConfig() {
        console.log('Getting Firebase configuration...');
        console.log('Hostname:', window.location.hostname);
        console.log('Environment variables available:', {
            apiKey: !!window.VITE_FIREBASE_API_KEY,
            projectId: !!window.VITE_FIREBASE_PROJECT_ID,
            authDomain: !!window.VITE_FIREBASE_AUTH_DOMAIN
        });
        
        // Try to get config from environment variables first (for Netlify deployment)
        const envConfig = {
            apiKey: window.VITE_FIREBASE_API_KEY,
            authDomain: window.VITE_FIREBASE_AUTH_DOMAIN,
            databaseURL: window.VITE_FIREBASE_DATABASE_URL,
            projectId: window.VITE_FIREBASE_PROJECT_ID,
            storageBucket: window.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: window.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: window.VITE_FIREBASE_APP_ID,
            measurementId: window.VITE_FIREBASE_MEASUREMENT_ID
        };
        
        // Check if we have at least the essential config from environment variables
        if (envConfig.apiKey && envConfig.projectId) {
            console.log('Using environment variables for Firebase config');
            return envConfig;
        }
        
        // Fallback to local firebase-config.js file
        try {
            const { firebaseConfig } = await import('../../firebase-config.js');
            console.log('Using local firebase-config.js file');
            return firebaseConfig;
        } catch (error) {
            console.error('Failed to load local firebase-config.js:', error);
            throw new Error('Firebase configuration not found. Please set up environment variables or create firebase-config.js file.');
        }
    }

    async fetchStations() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // If local data only mode is enabled, use local data directly
        if (this.useLocalDataOnly) {
            console.log('🏠 Using local data only (flag enabled)');
            try {
                if (typeof window.localDataService !== 'undefined') {
                    const localStations = await window.localDataService.fetchStations();
                    console.log(`✅ Successfully loaded ${localStations.length} stations from local data`);
                    return localStations;
                } else {
                    throw new Error('Local data service not available');
                }
            } catch (error) {
                console.error('Local data fetch failed:', error);
                throw new Error('Unable to fetch station data from local source');
            }
        }

        try {
            console.log('Fetching stations from Firebase...');
            console.log('Database object:', this.db);
            console.log('Collection function:', this.collection);
            console.log('GetDocs function:', this.getDocs);
            
            const stationsRef = this.collection(this.db, 'stations');
            console.log('Stations reference created:', stationsRef);
            
            const snapshot = await this.getDocs(stationsRef);
            console.log('Snapshot received:', snapshot);
            
            const stations = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                
                // Extract coordinates from various formats
                let latitude = 0;
                let longitude = 0;
                let extracted = false;
                
                // Method 1: Parse location data (string, array, or object)
                if (data.location) {
                    if (typeof data.location === 'string') {
                        const coords = this.parseLocationString(data.location);
                        if (coords) {
                            latitude = coords.latitude;
                            longitude = coords.longitude;
                            extracted = true;
                        }
                    } else if (Array.isArray(data.location) && data.location.length >= 2) {
                        const lat = parseFloat(data.location[0]);
                        const lng = parseFloat(data.location[1]);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            latitude = lat;
                            longitude = lng;
                            extracted = true;
                        }
                    } else if (typeof data.location === 'object' && data.location !== null) {
                        const lat = parseFloat(data.location.latitude || data.location.lat);
                        const lng = parseFloat(data.location.longitude || data.location.lng || data.location.lon);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            latitude = lat;
                            longitude = lng;
                            extracted = true;
                        }
                    }
                }
                
                // Method 2: Standard latitude/longitude fields
                if (!extracted && data.latitude && data.longitude) {
                    if (data.latitude._lat !== undefined && data.longitude._long !== undefined) {
                        latitude = data.latitude._lat;
                        longitude = data.longitude._long;
                        extracted = true;
                    } else if (data.latitude.latitude !== undefined && data.longitude.longitude !== undefined) {
                        latitude = data.latitude.latitude;
                        longitude = data.longitude.longitude;
                        extracted = true;
                    } else if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                        latitude = data.latitude;
                        longitude = data.longitude;
                        extracted = true;
                    } else if (typeof data.latitude === 'object' && typeof data.longitude === 'object') {
                        const latValues = Object.values(data.latitude).filter(v => typeof v === 'number');
                        const lngValues = Object.values(data.longitude).filter(v => typeof v === 'number');
                        
                        if (latValues.length > 0 && lngValues.length > 0) {
                            latitude = latValues[0];
                            longitude = lngValues[0];
                            extracted = true;
                        }
                    }
                }
                
                const station = {
                    id: doc.id, // Firebase document ID (this is the station ID)
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
                };
                
                stations.push(station);
            });
            
            console.log(`Successfully fetched ${stations.length} stations from Firebase`);
            return stations;
            
        } catch (error) {
            console.error('Firebase fetch error:', error);
            console.log('🔄 Falling back to local data...');
            
            // Fallback to local data service
            try {
                if (typeof window.localDataService !== 'undefined') {
                    const localStations = await window.localDataService.fetchStations();
                    console.log(`✅ Successfully loaded ${localStations.length} stations from local data`);
                    return localStations;
                } else {
                    console.error('Local data service not available');
                    throw new Error('Both Firebase and local data services are unavailable');
                }
            } catch (localError) {
                console.error('Local data fallback failed:', localError);
                throw new Error('Unable to fetch station data from any source');
            }
        }
    }

    parseLocationString(locationString) {
        try {
            if (!locationString || typeof locationString !== 'string') {
                return null;
            }
            
            // Handle format like "[51.59792249° N, 0.12023522° W]"
            if (locationString.includes('°')) {
                const cleanString = locationString.replace(/[\[\]]/g, '');
                const parts = cleanString.split(',');
                
                if (parts.length === 2) {
                    const latPart = parts[0].trim();
                    const latMatch = latPart.match(/(\d+\.?\d*)\s*°\s*([NS])/i);
                    
                    const lngPart = parts[1].trim();
                    const lngMatch = lngPart.match(/(\d+\.?\d*)\s*°\s*([EW])/i);
                    
                    if (latMatch && lngMatch) {
                        let latitude = parseFloat(latMatch[1]);
                        let longitude = parseFloat(lngMatch[1]);
                        
                        if (latMatch[2].toUpperCase() === 'S') {
                            latitude = -latitude;
                        }
                        if (lngMatch[2].toUpperCase() === 'W') {
                            longitude = -longitude;
                        }
                        
                        return { latitude, longitude };
                    }
                }
            }
            
            // Handle format like "[51.59792249, -0.12023522]"
            if (locationString.startsWith('[') && locationString.endsWith(']')) {
                const cleanString = locationString.replace(/[\[\]]/g, '');
                const parts = cleanString.split(',');
                
                if (parts.length === 2) {
                    const latitude = parseFloat(parts[0].trim());
                    const longitude = parseFloat(parts[1].trim());
                    
                    if (!isNaN(latitude) && !isNaN(longitude)) {
                        return { latitude, longitude };
                    }
                }
            }
            
            // Handle format like "51.59792249, -0.12023522"
            if (locationString.includes(',')) {
                const parts = locationString.split(',');
                if (parts.length === 2) {
                    const latitude = parseFloat(parts[0].trim());
                    const longitude = parseFloat(parts[1].trim());
                    
                    if (!isNaN(latitude) && !isNaN(longitude)) {
                        return { latitude, longitude };
                    }
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('Error parsing location string:', locationString, error);
            return null;
        }
    }
}

// Create global instance
window.firebaseService = new FirebaseService();
