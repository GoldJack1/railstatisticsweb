// Rail Statistics Migration Tool - JavaScript
class MigrationTool {
    constructor() {
        this.uploadedStations = [];
        this.matchedStations = [];
        this.unmatchedStations = [];
        this.firebaseStations = [];
        this.currentStep = 1;
        this.fuzzyMatchThreshold = 0.5;
        this.isProcessingFile = false;
        this.matchingLog = [];
        this.logStats = {
            matched: 0,
            unmatched: 0,
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0
        };
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeEventListeners();
                this.loadFirebaseStations();
                // Ensure step 1 is visible on initial load
                this.goToStep(1);
            });
        } else {
            this.initializeEventListeners();
            this.loadFirebaseStations();
            // Ensure step 1 is visible on initial load
            this.goToStep(1);
        }
    }

    initializeEventListeners() {
        // File upload
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');
        
        if (fileInput) {
            // Ensure the file input is properly configured
            fileInput.setAttribute('accept', '.csv,.txt');
            fileInput.style.display = 'none';
            fileInput.disabled = false;
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
        } else {
            // Create a file input if it doesn't exist
            const newFileInput = document.createElement('input');
            newFileInput.type = 'file';
            newFileInput.id = 'file-input';
            newFileInput.accept = '.csv,.txt';
            newFileInput.style.display = 'none';
            
            newFileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
            
            // Add it to the upload area
            const uploadArea = document.getElementById('upload-area');
            if (uploadArea) {
                uploadArea.appendChild(newFileInput);
            } else {
                document.body.appendChild(newFileInput);
            }
        }
        
        if (uploadArea) {
            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
            
            // Click to upload - always allow clicking to select a new file
            uploadArea.addEventListener('click', (e) => {
                const currentFileInput = document.getElementById('file-input');
                if (currentFileInput) {
                    currentFileInput.click();
                }
            });
        } else {
            console.error('Upload area element not found!');
        }
        
        // Browse button
        const browseButton = document.getElementById('browse-button');
        if (browseButton) {
            browseButton.addEventListener('click', (e) => {
                const currentFileInput = document.getElementById('file-input');
                if (currentFileInput) {
                    currentFileInput.click();
                }
            });
        }
        
        // Search and filter
        const searchInput = document.getElementById('preview-search-input');
        const filterSelect = document.getElementById('filter-select');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterStations());
        }
        
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => this.filterStations());
        }
    }

    async loadFirebaseStations() {
        try {
            console.log('Loading Firebase stations...');
            
            // Wait for Firebase to be available (with timeout)
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait
            
            while ((!window.firebaseDb || !window.firebaseCollection || !window.firebaseGetDocs) && attempts < maxAttempts) {
                console.log(`Waiting for Firebase initialization... (attempt ${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            // Check if Firebase is available after waiting
            if (!window.firebaseDb || !window.firebaseCollection || !window.firebaseGetDocs) {
                console.error('Firebase objects status:', {
                    firebaseDb: !!window.firebaseDb,
                    firebaseCollection: !!window.firebaseCollection,
                    firebaseGetDocs: !!window.firebaseGetDocs,
                    firebaseApp: !!window.firebaseApp
                });
                throw new Error('Firebase not available after waiting. Please check your Firebase configuration and refresh the page.');
            }
            
            console.log('Firebase is ready, proceeding with station loading...');
            
            // Fetch from Firebase
            this.firebaseStations = await this.fetchFirebaseStations();
            console.log(`Loaded ${this.firebaseStations.length} Firebase stations`);
            
            // Debug: Show first few stations
            if (this.firebaseStations.length > 0) {
                console.log('Sample Firebase stations:', this.firebaseStations.slice(0, 3).map(s => ({
                    name: s.stationName,
                    crs: s.crsCode,
                    hasCoords: !!(s.latitude && s.longitude)
                })));
            }
            
        } catch (error) {
            console.error('Error loading Firebase stations:', error);
            this.showError('Failed to load station database from Firebase. Please check your connection and try again.');
            throw error;
        }
    }

    async fetchFirebaseStations() {
        const { firebaseDb, firebaseCollection, firebaseGetDocs } = window;
        
        try {
            console.log('Fetching stations from Firebase...');
            console.log('Firebase objects:', { firebaseDb: !!firebaseDb, firebaseCollection: !!firebaseCollection, firebaseGetDocs: !!firebaseGetDocs });
            
            const stationsRef = firebaseCollection(firebaseDb, 'stations');
            console.log('Stations reference created:', !!stationsRef);
            
            const snapshot = await firebaseGetDocs(stationsRef);
            console.log('Firebase snapshot received:', snapshot.docs?.length || 'no docs property');
            
            const stations = [];
            let processedCount = 0;
            snapshot.forEach((doc) => {
                const data = doc.data();
                processedCount++;
                
                if (processedCount <= 3) {
                    console.log(`Processing station ${processedCount}:`, {
                        id: doc.id,
                        stationName: data.stationName,
                        hasLocation: !!data.location,
                        hasLatitude: !!data.latitude,
                        hasLongitude: !!data.longitude
                    });
                }
                
                // Debug: Log the complete document for first few stations
                if (stations.length < 3) {
                    console.log('Complete Firebase document:', {
                        docId: doc.id,
                        data: data,
                        hasLatitude: 'latitude' in data,
                        hasLongitude: 'longitude' in data,
                        latitudeValue: data.latitude,
                        longitudeValue: data.longitude,
                        // Check for alternative coordinate field names
                        hasLat: 'lat' in data,
                        hasLng: 'lng' in data,
                        hasCoordinates: 'coordinates' in data,
                        hasLocation: 'location' in data,
                        hasGeoPoint: 'geoPoint' in data,
                        // Show all field names
                        allFields: Object.keys(data)
                    });
                }
                
                // Extract coordinates from various formats
                let latitude = 0;
                let longitude = 0;
                let extracted = false;
                
                // Debug: Log raw coordinate data for first few stations (only if needed)
                if (stations.length < 3 && !data.location) {
                    console.log('No location data found for:', {
                        stationName: data.stationName,
                        hasLocation: !!data.location,
                        hasLatitude: !!data.latitude,
                        hasLongitude: !!data.longitude
                    });
                }
                
                // Method 1: Parse location data (string, array, or object)
                if (data.location) {
                    // Handle string format like "[51.59792249° N, 0.12023522° W]"
                    if (typeof data.location === 'string') {
                        const coords = this.parseLocationString(data.location);
                        if (coords) {
                            latitude = coords.latitude;
                            longitude = coords.longitude;
                            extracted = true;
                        }
                    }
                    // Handle array format like [51.59792249, -0.12023522]
                    else if (Array.isArray(data.location) && data.location.length >= 2) {
                        const lat = parseFloat(data.location[0]);
                        const lng = parseFloat(data.location[1]);
                        
                        if (!isNaN(lat) && !isNaN(lng)) {
                            latitude = lat;
                            longitude = lng;
                            extracted = true;
                        }
                    }
                    // Handle object format like {latitude: 51.59792249, longitude: -0.12023522}
                    else if (typeof data.location === 'object' && data.location !== null) {
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
                    // Try multiple extraction methods for GeoPoint objects
                    
                    // Method 2a: Standard Firebase GeoPoint (_lat, _long)
                    if (data.latitude._lat !== undefined && data.longitude._long !== undefined) {
                        latitude = data.latitude._lat;
                        longitude = data.longitude._long;
                        extracted = true;
                    }
                    // Method 2b: Alternative GeoPoint format (.latitude, .longitude)
                    else if (data.latitude.latitude !== undefined && data.longitude.longitude !== undefined) {
                        latitude = data.latitude.latitude;
                        longitude = data.longitude.longitude;
                        extracted = true;
                    }
                    // Method 2c: Direct numbers
                    else if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
                        latitude = data.latitude;
                        longitude = data.longitude;
                        extracted = true;
                    }
                    // Method 2d: Try to extract from any numeric properties
                    else if (typeof data.latitude === 'object' && typeof data.longitude === 'object') {
                        // Look for any numeric properties in the objects
                        const latValues = Object.values(data.latitude).filter(v => typeof v === 'number');
                        const lngValues = Object.values(data.longitude).filter(v => typeof v === 'number');
                        
                        if (latValues.length > 0 && lngValues.length > 0) {
                            latitude = latValues[0];
                            longitude = lngValues[0];
                            extracted = true;
                        }
                    }
                }
                
                if (!extracted && stations.length < 5) {
                    // Only log for first few stations to avoid spam
                    console.warn('Could not extract coordinates for:', data.stationName);
                    console.warn('Location data:', data.location, 'Type:', typeof data.location);
                }
                
                
                const station = {
                    id: doc.id,
                    stationName: data.stationName || '',
                    crsCode: data.crsCode || '',
                    stnCrsId: data.stnCrsId || null,
                    tiploc: data.tiploc || null,
                    latitude: latitude,
                    longitude: longitude,
                    country: data.country || null,
                    county: data.county || null,
                    toc: data.toc || null,
                    yearlyPassengers: data.yearlyPassengers || null
                    // Note: Personal tracking data (isVisited, visitedDates, isFavorite, notes) 
                    // comes from the user's CSV file, not from Firebase
                };
                
                stations.push(station);
                
                if (stations.length <= 3) {
                    console.log(`Created station ${stations.length}:`, {
                        name: station.stationName,
                        crs: station.crsCode,
                        coords: `${station.latitude}, ${station.longitude}`,
                        hasCoords: !!(station.latitude && station.longitude)
                    });
                }
            });
            
            console.log(`Successfully fetched ${stations.length} stations from Firebase`);
            return stations;
            
        } catch (error) {
            console.error('Firebase fetch error:', error);
            throw error;
        }
    }


    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        // Prevent multiple file processing
        if (this.isProcessingFile) {
            console.log('File processing already in progress, ignoring new file');
            return;
        }
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('Please select a CSV file.');
            return;
        }

        this.isProcessingFile = true;
        this.showFileInfo(file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                console.log('File loaded, starting CSV parsing...');
                this.parseCSV(e.target.result);
                this.goToStep(2);
            } catch (error) {
                console.error('Error parsing CSV:', error);
                this.showError(`Error parsing CSV file: ${error.message}. Please check the format and try again.`);
            } finally {
                this.isProcessingFile = false;
            }
        };
        
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            this.showError('Error reading the file. Please try again.');
            this.isProcessingFile = false;
        };
        reader.readAsText(file);
    }

    showFileInfo(file) {
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = this.formatFileSize(file.size);
        document.getElementById('file-info').style.display = 'block';
        document.getElementById('upload-area').style.display = 'none';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    parseCSV(csvContent) {
        console.log('Parsing CSV content...');
        
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }

        const headers = this.parseCSVLine(lines[0]);
        const csvFormat = this.detectCSVFormat(headers);
        
        console.log('Detected format:', csvFormat);
        console.log('Headers count:', headers.length);
        console.log('First 10 headers:', headers.slice(0, 10));

        this.uploadedStations = [];
        let skippedLines = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const values = this.parseCSVLine(line);
                
                // More flexible column matching - don't require exact count
                if (values.length < 5) { // Minimum required columns
                    console.warn(`Skipping line ${i + 1}: insufficient columns (${values.length})`);
                    skippedLines++;
                    continue;
                }
                
                const station = this.createStationFromCSVRow(headers, values, csvFormat);
                this.uploadedStations.push(station);
                
                // Log progress for large files
                if (i % 100 === 0) {
                    console.log(`Parsed ${i} lines...`);
                }
                
            } catch (error) {
                console.warn(`Error parsing line ${i + 1}:`, error.message);
                skippedLines++;
                continue;
            }
        }

        console.log(`Parsed ${this.uploadedStations.length} stations (skipped ${skippedLines} lines)`);
        this.updateDataSummary();
        this.populatePreviewTable();
    }

    parseCSVLine(line) {
        const result = [];
        let currentField = '';
        let insideQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                if (insideQuotes && line[i + 1] === '"') {
                    // Escaped quote
                    currentField += '"';
                    i += 2;
                } else {
                    // Toggle quote state
                    insideQuotes = !insideQuotes;
                    i++;
                }
            } else if (char === ',' && !insideQuotes) {
                // Field separator
                result.push(currentField.trim());
                currentField = '';
                i++;
            } else {
                currentField += char;
                i++;
            }
        }
        
        // Add the last field
        result.push(currentField.trim());
        return result;
    }

    detectCSVFormat(headers) {
        const headerSet = new Set(headers.map(h => h.toLowerCase()));
        
        // Check for oldformatv2 indicators
        if (headerSet.has('type') && headerSet.has('operator') && 
            headerSet.has('visit date dd/mm/yyyy') && headerSet.has('favourite')) {
            return 'oldformatv2';
        }
        
        // Check for exported3 indicators
        if (headerSet.has('station name') && headerSet.has('operator') && 
            headerSet.has('visit date') && headerSet.has('favorite') && 
            !headerSet.has('type')) {
            return 'exported3';
        }
        
        // Check for original format indicators
        if (headerSet.has('station') && headerSet.has('country') && 
            headerSet.has('county') && headerSet.has('toc') && 
            headerSet.has('visited') && headerSet.has('latitude') && 
            headerSet.has('longitude')) {
            return 'original';
        }
        
        // Fallback
        if (headerSet.has('operator') && headerSet.has('visit date')) {
            return 'exported3';
        } else if (headerSet.has('operator')) {
            return 'oldformatv2';
        } else if (headerSet.has('toc')) {
            return 'original';
        }
        
        return 'original';
    }

    createStationFromCSVRow(headers, values, format) {
        const station = {
            id: Math.random().toString(36).substr(2, 9),
            stationName: '',
            country: null,
            county: null,
            toc: null,
            isVisited: false,
            visitedDates: [], // Initialize as array for multiple visit dates
            isFavorite: false,
            latitude: null,
            longitude: null,
            yearlyPassengers: {},
            csvType: null,
            matchedStation: null,
            matchConfidence: 0,
            isMatched: false
        };

        // Ensure we don't go beyond available values
        const maxIndex = Math.min(headers.length, values.length);
        
        for (let i = 0; i < maxIndex; i++) {
            const header = headers[i].toLowerCase();
            const value = values[i] || '';
            
            try {
                switch (header) {
                case 'station':
                case 'station name':
                    station.stationName = value;
                    break;
                case 'country':
                    station.country = value || null;
                    break;
                case 'county':
                    station.county = value || null;
                    break;
                case 'toc':
                case 'operator':
                    station.toc = value || null;
                    break;
                case 'visited':
                    station.isVisited = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
                    break;
                case 'visit date dd/mm/yyyy':
                case 'visit date':
                case 'visit dates':
                    // Handle both single date and multiple dates (semicolon-separated)
                    if (value.includes(';')) {
                        // Multiple dates separated by semicolons
                        station.visitedDates = value.split(';').map(dateStr => this.parseVisitDate(dateStr.trim())).filter(date => date !== null);
                    } else {
                        // Single date
                        const parsedDate = this.parseVisitDate(value);
                        station.visitedDates = parsedDate ? [parsedDate] : [];
                    }
                    break;
                case 'favourite':
                case 'favorite':
                    station.isFavorite = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
                    break;
                case 'latitude':
                    station.latitude = parseFloat(value) || null;
                    break;
                case 'longitude':
                    station.longitude = parseFloat(value) || null;
                    break;
                case 'type':
                    station.csvType = value || null;
                    break;
                default:
                    // Check if it's a year column
                    if (header.length === 4 && /^\d{4}$/.test(header)) {
                        const year = parseInt(header);
                        if (year >= 1990 && year <= 2030) {
                            station.yearlyPassengers[header] = this.parsePassengerCount(value);
                        }
                    }
                    break;
                }
            } catch (error) {
                console.warn(`Error processing field ${header}:`, error.message);
                // Continue processing other fields
            }
        }

        return station;
    }

    parseVisitDate(dateString) {
        if (!dateString) return null;
        
        // Try DD/MM/YYYY format
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
            const year = parseInt(parts[2]);
            
            if (day && month >= 0 && year) {
                return new Date(year, month, day);
            }
        }
        
        return null;
    }

    parsePassengerCount(value) {
        if (!value || value.toLowerCase() === 'n/a') return null;
        
        const cleaned = value.replace(/,/g, '').trim();
        const parsed = parseInt(cleaned);
        return isNaN(parsed) ? null : parsed;
    }

    updateDataSummary() {
        const total = this.uploadedStations.length;
        const visited = this.uploadedStations.filter(s => s.isVisited).length;
        const favorites = this.uploadedStations.filter(s => s.isFavorite).length;
        
        const totalElement = document.getElementById('total-stations');
        const visitedElement = document.getElementById('visited-stations');
        const favoritesElement = document.getElementById('favorite-stations');
        
        if (totalElement) totalElement.textContent = total;
        if (visitedElement) visitedElement.textContent = visited;
        if (favoritesElement) favoritesElement.textContent = favorites;
    }

    populatePreviewTable() {
        const tbody = document.getElementById('preview-tbody');
        if (!tbody) {
            console.error('Preview table body not found');
            return;
        }
        
        tbody.innerHTML = '';
        
        this.uploadedStations.slice(0, 50).forEach(station => {
            const row = document.createElement('tr');
            
            const statusBadges = [];
            if (station.isVisited) statusBadges.push('<span class="status-badge status-visited">Visited</span>');
            if (station.isFavorite) statusBadges.push('<span class="status-badge status-favorite">Favorite</span>');
            if (!station.isVisited) statusBadges.push('<span class="status-badge status-unvisited">Unvisited</span>');
            
            row.innerHTML = `
                <td>${station.stationName}</td>
                <td>${station.country || '-'}</td>
                <td>${station.county || '-'}</td>
                <td>${station.toc || '-'}</td>
                <td>${statusBadges.join(' ')}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    filterStations() {
        const searchTerm = document.getElementById('preview-search-input').value.toLowerCase();
        const filter = document.getElementById('filter-select').value;
        
        let filtered = this.uploadedStations;
        
        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(station => 
                station.stationName.toLowerCase().includes(searchTerm) ||
                (station.country && station.country.toLowerCase().includes(searchTerm)) ||
                (station.county && station.county.toLowerCase().includes(searchTerm)) ||
                (station.toc && station.toc.toLowerCase().includes(searchTerm))
            );
        }
        
        // Apply status filter
        switch (filter) {
            case 'visited':
                filtered = filtered.filter(s => s.isVisited);
                break;
            case 'unvisited':
                filtered = filtered.filter(s => !s.isVisited);
                break;
            case 'favorites':
                filtered = filtered.filter(s => s.isFavorite);
                break;
        }
        
        this.populateFilteredTable(filtered);
    }

    populateFilteredTable(stations) {
        const tbody = document.getElementById('preview-tbody');
        if (!tbody) {
            console.error('Preview table body not found');
            return;
        }
        
        tbody.innerHTML = '';
        
        stations.slice(0, 100).forEach(station => {
            const row = document.createElement('tr');
            
            const statusBadges = [];
            if (station.isVisited) statusBadges.push('<span class="status-badge status-visited">Visited</span>');
            if (station.isFavorite) statusBadges.push('<span class="status-badge status-favorite">Favorite</span>');
            if (!station.isVisited) statusBadges.push('<span class="status-badge status-unvisited">Unvisited</span>');
            
            row.innerHTML = `
                <td>${station.stationName}</td>
                <td>${station.country || '-'}</td>
                <td>${station.county || '-'}</td>
                <td>${station.toc || '-'}</td>
                <td>${statusBadges.join(' ')}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    async startMatching() {
        this.showLoading('Starting station matching...');
        
        // Initialize matching log
        this.matchingLog = [];
        this.logStats = {
            matched: 0,
            unmatched: 0,
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0
        };
        
        // Show matching log
        const matchingLog = document.getElementById('matching-log');
        if (matchingLog) {
            matchingLog.style.display = 'block';
        }
        
        try {
            await this.performFuzzyMatching();
            this.hideLoading();
            this.goToStep(3);
        } catch (error) {
            this.hideLoading();
            console.error('Error during matching:', error);
            this.showError('Error during station matching. Please try again.');
        }
    }

    async performFuzzyMatching() {
        console.log('Starting fuzzy matching...');
        console.log('Uploaded stations:', this.uploadedStations.length);
        console.log('Firebase stations:', this.firebaseStations.length);
        
        if (this.firebaseStations.length === 0) {
            console.error('No Firebase stations loaded! Cannot perform matching.');
            this.showError('No station database loaded. Please check your Firebase connection.');
            return;
        }
        
        this.matchedStations = [];
        this.unmatchedStations = [];
        
        // Track which Firebase stations have already been matched to prevent duplicates
        const usedFirebaseStations = new Set();
        
        const total = this.uploadedStations.length;
        let processed = 0;
        
        for (const csvStation of this.uploadedStations) {
            const bestMatch = this.findBestMatch(csvStation, this.firebaseStations);
            
            if (bestMatch.match && bestMatch.confidence >= this.fuzzyMatchThreshold) {
                // Check if this Firebase station has already been matched to prevent duplicates
                if (usedFirebaseStations.has(bestMatch.match.id)) {
                    console.warn(`Firebase station ${bestMatch.match.stationName} (${bestMatch.match.id}) already matched, skipping duplicate`);
                    this.unmatchedStations.push(csvStation);
                    this.addLogEntry('warning', csvStation, bestMatch.match, bestMatch.confidence, 'Duplicate match prevented');
                    this.logStats.unmatched++;
                } else {
                    // Mark this Firebase station as used
                    usedFirebaseStations.add(bestMatch.match.id);
                
                // Update the CSV station with Firebase data while preserving CSV user data
                    csvStation.id = bestMatch.match.id; // Use Firebase document ID as the primary identifier
                csvStation.stationName = bestMatch.match.stationName;
                csvStation.country = bestMatch.match.country;
                csvStation.county = bestMatch.match.county;
                csvStation.toc = bestMatch.match.toc;
                csvStation.latitude = bestMatch.match.latitude;
                csvStation.longitude = bestMatch.match.longitude;
                csvStation.yearlyPassengers = bestMatch.match.yearlyPassengers;
                csvStation.crsCode = bestMatch.match.crsCode;
                csvStation.stnCrsId = bestMatch.match.stnCrsId;
                csvStation.tiploc = bestMatch.match.tiploc;
                
                // Preserve personal tracking data from CSV (user's data from uploaded file)
                // Don't overwrite with Firebase data - keep the user's original tracking data
                
                // Set matching metadata
                csvStation.matchedStation = bestMatch.match;
                csvStation.matchConfidence = bestMatch.confidence;
                csvStation.isMatched = true;
                this.matchedStations.push(csvStation);
                
                // Log successful match (show original Firebase station for reference)
                this.addLogEntry('success', csvStation, bestMatch.match, bestMatch.confidence);
                this.logStats.matched++;
                
                // Update confidence stats
                if (bestMatch.confidence >= 0.8) {
                    this.logStats.highConfidence++;
                } else if (bestMatch.confidence >= 0.6) {
                    this.logStats.mediumConfidence++;
                } else {
                    this.logStats.lowConfidence++;
                    }
                }
            } else {
                // Add unmatched stations directly to matched list (no manual review needed)
                csvStation.isMatched = true;
                csvStation.matchConfidence = 0.0; // Mark as unmatched but included
                this.matchedStations.push(csvStation);
                
                // Log unmatched station as included
                this.addLogEntry('info', csvStation, null, 0.0, 'Station included without matching');
                this.logStats.unmatched++;
            }
            
            processed++;
            const progress = (processed / total) * 100;
            this.updateProgress(progress, `Matching stations... ${processed}/${total}`);
            
            // Update log stats
            this.updateLogStats();
            
            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        this.updateProgress(100, 'Matching completed!');
        this.showMatchingResults();
    }

    findBestMatch(csvStation, firebaseStations) {
        let bestMatch = null;
        let bestConfidence = 0.0;
        
        // Strategy 1: Try exact CRS code match first (highest priority)
        const csvCRS = this.extractCRSCode(csvStation.stationName);
        if (csvCRS && csvCRS.length > 0) {
            for (const firebaseStation of firebaseStations) {
                if (csvCRS.toLowerCase() === firebaseStation.crsCode.toLowerCase()) {
                    return { match: firebaseStation, confidence: 1.0 };
                }
            }
        }
        
        // Strategy 2: Try exact name match (with full parenthetical info first)
        const csvName = csvStation.stationName.toLowerCase();
        for (const firebaseStation of firebaseStations) {
            const firebaseName = firebaseStation.stationName.toLowerCase();
            if (csvName === firebaseName) {
                return { match: firebaseStation, confidence: 1.0 };
            }
        }
        
        // Strategy 2b: Try exact core name match (without obvious location qualifiers)
        const csvCoreName = this.extractCoreStationName(csvStation.stationName.toLowerCase());
        if (csvCoreName !== csvName) { // Only if we actually removed something
            for (const firebaseStation of firebaseStations) {
                const firebaseCoreName = this.extractCoreStationName(firebaseStation.stationName.toLowerCase());
                if (csvCoreName === firebaseCoreName) {
                    return { match: firebaseStation, confidence: 0.95 };
                }
            }
        }
        
        // Strategy 3: Try comprehensive matching with all factors
        for (const firebaseStation of firebaseStations) {
            const confidence = this.calculateMatchConfidence(csvStation, firebaseStation);
            
            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestMatch = firebaseStation;
            }
        }
        
        // Strategy 4: If no good match found, try fuzzy name matching with lower threshold
        if (bestConfidence < 0.6) {
            for (const firebaseStation of firebaseStations) {
                const nameSimilarity = this.calculateStringSimilarity(csvStation.stationName, firebaseStation.stationName);
                if (nameSimilarity > 0.5 && nameSimilarity > bestConfidence) { // Lowered threshold
                    bestConfidence = nameSimilarity;
                    bestMatch = firebaseStation;
                }
            }
        }
        
        // Strategy 5: Last resort - very lenient name matching
        if (bestConfidence < 0.4) {
            for (const firebaseStation of firebaseStations) {
                const nameSimilarity = this.calculateStringSimilarity(csvStation.stationName, firebaseStation.stationName);
                if (nameSimilarity > 0.3 && nameSimilarity > bestConfidence) { // Very low threshold
                    bestConfidence = nameSimilarity;
                    bestMatch = firebaseStation;
                }
            }
        }
        
        return { match: bestMatch, confidence: bestConfidence };
    }

    calculateMatchConfidence(csvStation, firebaseStation) {
        let confidence = 0;
        
        // Name matching (40% weight)
        const nameSimilarity = this.calculateStringSimilarity(csvStation.stationName, firebaseStation.stationName);
        confidence += nameSimilarity * 0.4;
        
        // CRS Code matching (25% weight)
        const csvCRS = this.extractCRSCode(csvStation.stationName);
        if (csvCRS) {
            const crsSimilarity = csvCRS.toLowerCase() === firebaseStation.crsCode.toLowerCase() ? 1.0 : 0.0;
            confidence += crsSimilarity * 0.25;
        }
        
        // TOC/Operator matching (15% weight)
        if (csvStation.toc && firebaseStation.toc) {
            const tocSimilarity = this.calculateStringSimilarity(csvStation.toc, firebaseStation.toc);
            confidence += tocSimilarity * 0.15;
        }
        
        // Country matching (10% weight)
        if (csvStation.country && firebaseStation.country) {
            const countrySimilarity = this.calculateStringSimilarity(csvStation.country, firebaseStation.country);
            confidence += countrySimilarity * 0.1;
        }
        
        // County matching (5% weight)
        if (csvStation.county && firebaseStation.county) {
            const countySimilarity = this.calculateStringSimilarity(csvStation.county, firebaseStation.county);
            confidence += countySimilarity * 0.05;
        }
        
        // Location matching (5% weight)
        if (csvStation.latitude && csvStation.longitude) {
            const distance = this.calculateDistance(
                csvStation.latitude, csvStation.longitude,
                firebaseStation.latitude, firebaseStation.longitude
            );
            const locationConfidence = distance < 1.0 ? 1.0 : Math.max(0.0, 1.0 - (distance / 10.0));
            confidence += locationConfidence * 0.05;
        }
        
        return Math.min(confidence, 1.0);
    }

    calculateStringSimilarity(str1, str2) {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        
        // Exact match (highest priority)
        if (s1 === s2) {
            return 1.0;
        }
        
        // Check if either string contains the other (with full parenthetical info)
        if (s1.includes(s2) || s2.includes(s1)) {
            return 0.9;
        }
        
        // Try core name matching (remove only obvious location qualifiers)
        const core1 = this.extractCoreStationName(s1);
        const core2 = this.extractCoreStationName(s2);
        
        // Only use core matching if we actually removed something and it's likely location info
        if (core1 !== s1 || core2 !== s2) {
            // Exact match on core names
            if (core1 === core2) {
                return 0.95;
            }
            
            // Check if core names contain each other
            if (core1.includes(core2) || core2.includes(core1)) {
                return 0.9;
            }
            
            // Check if core names are similar
            const coreSimilarity = this.calculateCoreSimilarity(core1, core2);
            if (coreSimilarity > 0.8) {
                return coreSimilarity;
            }
        }
        
        // Levenshtein distance based similarity on full strings
        const distance = this.levenshteinDistance(s1, s2);
        const maxLength = Math.max(s1.length, s2.length);
        const fullSimilarity = maxLength === 0 ? 0.0 : 1.0 - (distance / maxLength);
        
        // Also try core similarity as fallback
        const coreSimilarity = this.calculateCoreSimilarity(core1, core2);
        
        // Return the highest similarity found
        return Math.max(fullSimilarity, coreSimilarity);
    }

    extractCoreStationName(stationName) {
        // Remove location qualifiers and CRS codes
        const locationPatterns = [
            /\s*\([A-Z]{3}\)/, // CRS codes like (PAD), (VIC)
            /\s*\([A-Za-z\s]+shire\)/, // Counties like (Hampshire)
            /\s*\([A-Za-z\s]+shire\s+[A-Za-z]+\)/, // Multi-word counties
            /\s*\([A-Za-z\s]+\s+County\)/, // County qualifiers
            /\s*\([A-Za-z\s]+\s+City\)/, // City qualifiers
            /\s*\([A-Za-z\s]+\s+District\)/, // District qualifiers
            /\s*\([A-Za-z\s]+\s+Borough\)/ // Borough qualifiers
        ];
        
        let result = stationName;
        for (const pattern of locationPatterns) {
            result = result.replace(pattern, '');
        }
        
        return result.trim();
    }

    extractCRSCode(stationName) {
        const match = stationName.match(/\(([A-Z]{3})\)/);
        return match ? match[1] : null;
    }

    extractCoreStationName(stationName) {
        // Only remove obvious location qualifiers and CRS codes, preserve other important info
        const locationPatterns = [
            /\([A-Z]{3}\)/g, // CRS codes like (PAD), (VIC)
            /\([A-Za-z\s]+shire\)/g, // Counties like (Hampshire), (Yorkshire)
            /\([A-Za-z\s]+shire\s+[A-Za-z]+\)/g, // Multi-word counties
            /\([A-Za-z\s]+\s+County\)/g, // County qualifiers
            /\([A-Za-z\s]+\s+City\)/g, // City qualifiers
            /\([A-Za-z\s]+\s+District\)/g, // District qualifiers
            /\([A-Za-z\s]+\s+Borough\)/g, // Borough qualifiers
            /\(Herts\)/g, // Specific case for Hertfordshire
            /\(Herts\.\)/g, // Hertfordshire with period
            /\(Hertfordshire\)/g, // Full Hertfordshire
            /\(West\s+Yorkshire\)/g, // West Yorkshire
            /\(East\s+Yorkshire\)/g, // East Yorkshire
            /\(South\s+Yorkshire\)/g, // South Yorkshire
            /\(North\s+Yorkshire\)/g, // North Yorkshire
            /\(Greater\s+London\)/g, // Greater London
            /\(Greater\s+Manchester\)/g // Greater Manchester
        ];
        
        let result = stationName;
        
        for (const pattern of locationPatterns) {
            result = result.replace(pattern, '').trim();
        }
        
        return result;
    }

    calculateCoreSimilarity(core1, core2) {
        // Handle common station name variations
        const variations1 = this.generateNameVariations(core1);
        const variations2 = this.generateNameVariations(core2);
        
        // Check if any variations match
        for (const var1 of variations1) {
            for (const var2 of variations2) {
                if (var1 === var2) {
                    return 0.95;
                }
                if (var1.includes(var2) || var2.includes(var1)) {
                    return 0.9;
                }
            }
        }
        
        // Levenshtein distance on core names
        const distance = this.levenshteinDistance(core1, core2);
        const maxLength = Math.max(core1.length, core2.length);
        return maxLength === 0 ? 0.0 : 1.0 - (distance / maxLength);
    }

    generateNameVariations(name) {
        const variations = [name];
        
        // Add variations without common words
        const commonWords = ['station', 'railway', 'rail', 'junction', 'central', 'north', 'south', 'east', 'west'];
        
        for (const word of commonWords) {
            const withoutWord = name.replace(new RegExp(word, 'gi'), '').trim();
            if (withoutWord && withoutWord !== name) {
                variations.push(withoutWord);
            }
        }
        
        // Add variations with common abbreviations
        const abbreviations = {
            'st': 'saint',
            'st.': 'saint',
            'rd': 'road',
            'rd.': 'road',
            'ave': 'avenue',
            'ave.': 'avenue',
            '&': 'and'
        };
        
        for (const [abbrev, full] of Object.entries(abbreviations)) {
            const withFull = name.replace(new RegExp(abbrev, 'gi'), full);
            if (withFull !== name) {
                variations.push(withFull);
            }
            const withAbbrev = name.replace(new RegExp(full, 'gi'), abbrev);
            if (withAbbrev !== name) {
                variations.push(withAbbrev);
            }
        }
        
        return variations;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        const m = str1.length;
        const n = str2.length;
        
        for (let i = 0; i <= m; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= n; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }
        
        return matrix[m][n];
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const earthRadius = 6371; // km
        
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return earthRadius * c;
    }

    parseLocationString(locationString) {
        try {
            if (!locationString || typeof locationString !== 'string') {
                return null;
            }
            
            // Handle format like "[51.59792249° N, 0.12023522° W]"
            if (locationString.includes('°')) {
                // Remove brackets and split by comma
                const cleanString = locationString.replace(/[\[\]]/g, '');
                const parts = cleanString.split(',');
                
                if (parts.length === 2) {
                    // Parse latitude (first part)
                    const latPart = parts[0].trim();
                    const latMatch = latPart.match(/(\d+\.?\d*)\s*°\s*([NS])/i);
                    
                    // Parse longitude (second part)  
                    const lngPart = parts[1].trim();
                    const lngMatch = lngPart.match(/(\d+\.?\d*)\s*°\s*([EW])/i);
                    
                    if (latMatch && lngMatch) {
                        let latitude = parseFloat(latMatch[1]);
                        let longitude = parseFloat(lngMatch[1]);
                        
                        // Apply direction modifiers
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
            
            // Handle format like "[51.59792249, -0.12023522]" (simple decimal format)
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
            
            // Handle format like "51.59792249, -0.12023522" (comma-separated without brackets)
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

    addLogEntry(type, csvStation, firebaseStation, confidence, message = null) {
        const logEntry = {
            type: type,
            csvStation: csvStation,
            firebaseStation: firebaseStation,
            confidence: confidence,
            message: message,
            timestamp: new Date()
        };
        
        this.matchingLog.push(logEntry);
        this.renderLogEntry(logEntry);
        
        // Keep only last 100 entries for performance
        if (this.matchingLog.length > 100) {
            this.matchingLog.shift();
            this.removeOldLogEntry();
        }
    }

    renderLogEntry(logEntry) {
        const logEntries = document.getElementById('log-entries');
        if (!logEntries) return;
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'log-entry';
        
        const iconClass = logEntry.type === 'success' ? 'success' : 
                         logEntry.type === 'warning' ? 'warning' : 'error';
        const iconSymbol = logEntry.type === 'success' ? '✓' : 
                          logEntry.type === 'warning' ? '⚠' : '✗';
        
        const confidenceClass = logEntry.confidence >= 0.8 ? 'high' : 
                               logEntry.confidence >= 0.6 ? 'medium' : 'low';
        
        const matchDetails = logEntry.firebaseStation ? 
            `→ ${logEntry.firebaseStation.stationName} (${logEntry.firebaseStation.crsCode})` : 
            'No match found';
        
        const messageText = logEntry.message ? `<div class="log-entry-message">${logEntry.message}</div>` : '';
        
        entryDiv.innerHTML = `
            <div class="log-entry-icon ${iconClass}">${iconSymbol}</div>
            <div class="log-entry-content">
                <div class="log-entry-station">${logEntry.csvStation.stationName}</div>
                <div class="log-entry-details">${matchDetails}</div>
                ${messageText}
            </div>
            <div class="log-entry-confidence ${confidenceClass}">
                ${Math.round(logEntry.confidence * 100)}%
            </div>
        `;
        
        logEntries.appendChild(entryDiv);
        
        // Auto-scroll to bottom
        logEntries.scrollTop = logEntries.scrollHeight;
    }

    removeOldLogEntry() {
        const logEntries = document.getElementById('log-entries');
        if (logEntries && logEntries.firstChild) {
            logEntries.removeChild(logEntries.firstChild);
        }
    }

    updateLogStats() {
        const logStats = document.querySelector('.log-stats');
        if (!logStats) return;
        
        logStats.innerHTML = `
            <div class="log-stat">
                <div class="log-stat-icon success">✓</div>
                <span>Matched: ${this.logStats.matched}</span>
            </div>
            <div class="log-stat">
                <div class="log-stat-icon warning">⚠</div>
                <span>Unmatched: ${this.logStats.unmatched}</span>
            </div>
            <div class="log-stat">
                <span>High Confidence: ${this.logStats.highConfidence}</span>
            </div>
            <div class="log-stat">
                <span>Medium Confidence: ${this.logStats.mediumConfidence}</span>
            </div>
            <div class="log-stat">
                <span>Low Confidence: ${this.logStats.lowConfidence}</span>
            </div>
        `;
    }

    updateProgress(percentage, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) progressFill.style.width = percentage + '%';
        if (progressText) progressText.textContent = text;
    }

    showMatchingResults() {
        const matchedCount = document.getElementById('matched-count');
        const unmatchedCount = document.getElementById('unmatched-count');
        const matchingResults = document.getElementById('matching-results');
        const reviewMatchesBtn = document.getElementById('review-matches-btn');
        
        if (matchedCount) matchedCount.textContent = this.matchedStations.length;
        if (unmatchedCount) unmatchedCount.textContent = 0; // No unmatched stations since we include all
        if (matchingResults) matchingResults.style.display = 'block';
        if (reviewMatchesBtn) {
            // Hide the review button since we're skipping the review step
            reviewMatchesBtn.style.display = 'none';
        }
        
        // Automatically proceed to export since all stations are now included
        setTimeout(() => {
            this.goToStep(4); // Go directly to export (step 4 is now export)
        }, 2000); // Give user 2 seconds to see the results
    }

    populateUnmatchedStations() {
        const container = document.getElementById('unmatched-stations');
        if (!container) {
            console.error('Unmatched stations container not found');
            return;
        }
        
        container.innerHTML = '';
        
        if (this.unmatchedStations.length === 0) {
            container.innerHTML = `
                <div class="all-matched-success">
                    <i class="fas fa-check-circle"></i>
                    <h3>All stations have been matched!</h3>
                    <p>Great job! You can now proceed to export your data.</p>
                </div>
            `;
            return;
        }
        
        // Add summary statistics for unmatched stations only
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'match-summary';
        const totalStations = this.matchedStations.length + this.unmatchedStations.length;
        const unmatchedVisited = this.unmatchedStations.filter(s => s.isVisited).length;
        const unmatchedFavorites = this.unmatchedStations.filter(s => s.isFavorite).length;
        const unmatchedWithNotes = this.unmatchedStations.filter(s => s.notes).length;
        
        summaryDiv.innerHTML = `
            <div class="summary-header">
                <h3>🔍 Stations Needing Attention</h3>
                <p class="summary-subtitle">These ${this.unmatchedStations.length} stations need to be linked to the database</p>
            </div>
            <div class="summary-stats">
                <div class="stat-card total">
                    <div class="stat-icon">🚂</div>
                    <div class="stat-content">
                        <div class="stat-number">${totalStations}</div>
                        <div class="stat-label">Total Stations</div>
                    </div>
                </div>
                <div class="stat-card unmatched">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-content">
                        <div class="stat-number">${this.unmatchedStations.length}</div>
                        <div class="stat-label">Need Linking</div>
                    </div>
                </div>
                <div class="stat-card visited">
                    <div class="stat-icon">✅</div>
                    <div class="stat-content">
                        <div class="stat-number">${unmatchedVisited}</div>
                        <div class="stat-label">Visited</div>
                    </div>
                </div>
                <div class="stat-card favorites">
                    <div class="stat-icon">❤️</div>
                    <div class="stat-content">
                        <div class="stat-number">${unmatchedFavorites}</div>
                        <div class="stat-label">Favorites</div>
                    </div>
                </div>
                <div class="stat-card notes">
                    <div class="stat-icon">📝</div>
                    <div class="stat-content">
                        <div class="stat-number">${unmatchedWithNotes}</div>
                        <div class="stat-label">With Notes</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(summaryDiv);

        // Add header with progress info
        const headerDiv = document.createElement('div');
        headerDiv.className = 'unmatched-header';
        const progressPercentage = this.unmatchedStations.length > 0 ? 
            ((this.matchedStations.length / (this.matchedStations.length + this.unmatchedStations.length)) * 100) : 100;
        
        headerDiv.innerHTML = `
            <div class="progress-info">
                <h3>📋 Unmatched Stations List</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
                <p class="progress-text">${this.matchedStations.length} matched, ${this.unmatchedStations.length} remaining</p>
            </div>
        `;
        container.appendChild(headerDiv);
        
        this.unmatchedStations.forEach(station => {
            const stationDiv = document.createElement('div');
            stationDiv.className = 'unmatched-station-card';
            
            // Create status badges for user data
            const statusBadges = [];
            if (station.isVisited) statusBadges.push('<span class="status-badge visited"><i class="fas fa-check"></i> Visited</span>');
            if (station.isFavorite) statusBadges.push('<span class="status-badge favorite"><i class="fas fa-heart"></i> Favorite</span>');
            if (station.visitedDates && station.visitedDates.length > 0) {
                statusBadges.push(`<span class="status-badge dates"><i class="fas fa-calendar"></i> ${station.visitedDates.length} visit${station.visitedDates.length > 1 ? 's' : ''}</span>`);
            }
            if (station.notes) statusBadges.push('<span class="status-badge notes"><i class="fas fa-sticky-note"></i> Has notes</span>');
            
            stationDiv.innerHTML = `
                <div class="station-card-header">
                    <div class="station-title">
                    <h4>${station.stationName}</h4>
                        <div class="station-status-badges">
                            ${statusBadges.join('')}
                </div>
                    </div>
                    <div class="station-actions">
                        <button class="btn btn-primary search-btn" onclick="migrationTool.openSearchDialog('${station.id}')">
                            <i class="fas fa-search"></i> Find Match
                        </button>
                    </div>
                </div>
                <div class="station-details">
                    <div class="detail-row">
                        <span class="detail-label">Country:</span>
                        <span class="detail-value">${station.country || 'Unknown'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">County:</span>
                        <span class="detail-value">${station.county || 'Unknown'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Operator:</span>
                        <span class="detail-value">${station.toc || 'Unknown'}</span>
                    </div>
                    ${station.notes ? `
                    <div class="detail-row notes-row">
                        <span class="detail-label">Notes:</span>
                        <span class="detail-value notes-text">${station.notes}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            container.appendChild(stationDiv);
        });
    }

    populateMatchedStations() {
        const container = document.getElementById('matched-stations');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.matchedStations.length === 0) {
            container.innerHTML = `
                <div class="no-matched-stations">
                    <i class="fas fa-info-circle"></i>
                    <p>No stations have been matched yet. Use the search dialog to link your stations.</p>
                </div>
            `;
            return;
        }
        
        // Add header with summary
        const headerDiv = document.createElement('div');
        headerDiv.className = 'matched-header';
        const matchedVisited = this.matchedStations.filter(s => s.isVisited).length;
        const matchedFavorites = this.matchedStations.filter(s => s.isFavorite).length;
        const matchedWithNotes = this.matchedStations.filter(s => s.notes).length;
        
        headerDiv.innerHTML = `
            <div class="matched-info">
                <h3>✅ Matched Stations (${this.matchedStations.length})</h3>
                <p>These stations have been successfully linked to the database.</p>
                <div class="matched-summary">
                    <span class="matched-stat">${matchedVisited} visited</span>
                    <span class="matched-stat">${matchedFavorites} favorites</span>
                    <span class="matched-stat">${matchedWithNotes} with notes</span>
                </div>
            </div>
        `;
        container.appendChild(headerDiv);
        
        this.matchedStations.forEach(station => {
            const stationDiv = document.createElement('div');
            stationDiv.className = 'matched-station-card';
            
            // Create status badges for user data
            const statusBadges = [];
            if (station.isVisited) statusBadges.push('<span class="status-badge visited"><i class="fas fa-check"></i> Visited</span>');
            if (station.isFavorite) statusBadges.push('<span class="status-badge favorite"><i class="fas fa-heart"></i> Favorite</span>');
            if (station.visitedDates && station.visitedDates.length > 0) {
                statusBadges.push(`<span class="status-badge dates"><i class="fas fa-calendar"></i> ${station.visitedDates.length} visit${station.visitedDates.length > 1 ? 's' : ''}</span>`);
            }
            if (station.notes) statusBadges.push('<span class="status-badge notes"><i class="fas fa-sticky-note"></i> Has notes</span>');
            
            stationDiv.innerHTML = `
                <div class="station-card-header">
                    <div class="station-title">
                        <h4>${station.stationName}</h4>
                        <div class="station-status-badges">
                            ${statusBadges.join('')}
                        </div>
                    </div>
                    <div class="station-actions">
                        <span class="matched-badge">
                            <i class="fas fa-link"></i> Linked
                        </span>
                    </div>
                </div>
                <div class="station-details">
                    <div class="detail-row">
                        <span class="detail-label">CRS Code:</span>
                        <span class="detail-value">${station.crsCode || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Country:</span>
                        <span class="detail-value">${station.country || 'Unknown'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">County:</span>
                        <span class="detail-value">${station.county || 'Unknown'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Operator:</span>
                        <span class="detail-value">${station.toc || 'Unknown'}</span>
                    </div>
                    ${station.notes ? `
                    <div class="detail-row notes-row">
                        <span class="detail-label">Notes:</span>
                        <span class="detail-value notes-text">${station.notes}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            container.appendChild(stationDiv);
        });
    }

    openSearchDialog(stationId) {
        console.log('openSearchDialog called for station:', stationId);
        this.currentSearchStationId = stationId;
        const modal = document.getElementById('search-modal');
        const searchInput = document.getElementById('search-dialog-input');
        const resultsContainer = document.getElementById('search-dialog-results');
        
        console.log('Modal element found:', !!modal);
        console.log('Search input found:', !!searchInput);
        console.log('Results container found:', !!resultsContainer);
        
        // Reset the search
        searchInput.value = '';
        resultsContainer.innerHTML = `
            <div class="search-placeholder">
                <i class="fas fa-search"></i>
                <p>Start typing to search for stations...</p>
            </div>
        `;
        
        // Show the modal
        modal.style.display = 'flex';
        
        // Focus the input
        setTimeout(() => {
            searchInput.focus();
            // Test search to verify functionality
            console.log('Testing search functionality...');
            this.performDialogSearch('ford');
        }, 100);
        
        // Add event listeners
        searchInput.onkeyup = (e) => {
            console.log('Search input keyup event triggered:', e.key, e.target.value);
            if (e.key === 'Escape') {
                this.closeSearchDialog();
            } else {
                this.performDialogSearch(e.target.value);
            }
        };
        
        // Also add input event for better compatibility
        searchInput.oninput = (e) => {
            console.log('Search input input event triggered:', e.target.value);
            this.performDialogSearch(e.target.value);
        };
        
        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeSearchDialog();
            }
        };
    }

    closeSearchDialog() {
        const modal = document.getElementById('search-modal');
        modal.style.display = 'none';
        this.currentSearchStationId = null;
    }

    performDialogSearch(query) {
        console.log('performDialogSearch called with query:', query);
        const resultsContainer = document.getElementById('search-dialog-results');
        const trimmedQuery = query.toLowerCase().trim();
        
        console.log('Firebase stations available:', this.firebaseStations ? this.firebaseStations.length : 'undefined');
        
        if (trimmedQuery.length < 2) {
            resultsContainer.innerHTML = `
                <div class="search-placeholder">
                    <i class="fas fa-search"></i>
                    <p>Start typing to search for stations...</p>
                </div>
            `;
            return;
        }
        
        if (!this.firebaseStations || this.firebaseStations.length === 0) {
            console.log('No Firebase stations available for search');
            resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No station data available</p>
                    <small>Please wait for the data to load or refresh the page</small>
                </div>
            `;
            return;
        }
        
        // Enhanced search with better matching logic
        const results = this.firebaseStations.filter(station => {
            const stationName = (station.stationName || '').toLowerCase();
            const crsCode = (station.crsCode || '').toLowerCase();
            const country = (station.country || '').toLowerCase();
            const county = (station.county || '').toLowerCase();
            const toc = (station.toc || '').toLowerCase();
            
            // Multiple search strategies for better results
            return (
                // Exact word match (highest priority)
                stationName.includes(trimmedQuery) ||
                crsCode.includes(trimmedQuery) ||
                country.includes(trimmedQuery) ||
                county.includes(trimmedQuery) ||
                toc.includes(trimmedQuery) ||
                
                // Partial word match
                stationName.split(' ').some(word => word.includes(trimmedQuery)) ||
                stationName.split('-').some(word => word.includes(trimmedQuery)) ||
                stationName.split('(').some(word => word.includes(trimmedQuery)) ||
                
                // Fuzzy matching for common variations
                this.fuzzyMatch(stationName, trimmedQuery) ||
                this.fuzzyMatch(crsCode, trimmedQuery)
            );
        }).sort((a, b) => {
            // Sort by relevance: exact matches first, then partial matches
            const aName = a.stationName.toLowerCase();
            const bName = b.stationName.toLowerCase();
            
            // Exact match gets highest priority
            if (aName === trimmedQuery) return -1;
            if (bName === trimmedQuery) return 1;
            
            // Starts with query gets second priority
            if (aName.startsWith(trimmedQuery) && !bName.startsWith(trimmedQuery)) return -1;
            if (bName.startsWith(trimmedQuery) && !aName.startsWith(trimmedQuery)) return 1;
            
            // Contains query gets third priority
            if (aName.includes(trimmedQuery) && !bName.includes(trimmedQuery)) return -1;
            if (bName.includes(trimmedQuery) && !aName.includes(trimmedQuery)) return 1;
            
            // Alphabetical order for ties
            return aName.localeCompare(bName);
        }).slice(0, 20); // Show more results in dialog
        
        console.log(`Search for "${trimmedQuery}" found ${results.length} results:`, results.map(r => r.stationName));
        
        if (results.length > 0) {
            resultsContainer.innerHTML = results.map(station => `
                <div class="search-result-dialog" onclick="migrationTool.selectStationFromDialog('${station.id}')">
                    <div class="search-result-info">
                        <div class="search-result-name">${station.stationName}</div>
                        <div class="search-result-details">
                            ${station.country}${station.county ? ', ' + station.county : ''} - ${station.toc}
                        </div>
                    </div>
                    <div class="search-result-crs-dialog">${station.crsCode}</div>
                </div>
            `).join('');
            
            console.log('Results HTML generated and inserted');
        } else {
            resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-search"></i>
                    <p>No stations found for "${query}"</p>
                    <small>Try a different search term or check spelling</small>
                </div>
            `;
            console.log(`No results found for "${trimmedQuery}"`);
        }
    }

    selectStationFromDialog(firebaseStationId) {
        if (this.currentSearchStationId) {
            this.linkStation(this.currentSearchStationId, firebaseStationId);
            this.closeSearchDialog();
        }
    }

    fuzzyMatch(text, query) {
        // Simple fuzzy matching for search improvements
        if (!text || !query) return false;
        
        const textLower = text.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Check if all characters in query appear in order in text
        let queryIndex = 0;
        for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
            if (textLower[i] === queryLower[queryIndex]) {
                queryIndex++;
            }
        }
        
        // If we found all characters in order, it's a fuzzy match
        return queryIndex === queryLower.length;
    }

    linkStation(csvStationId, firebaseStationId) {
        const csvStation = this.unmatchedStations.find(s => s.id === csvStationId);
        const firebaseStation = this.firebaseStations.find(s => s.id === firebaseStationId);
        
        console.log('Linking stations:', {
            csvStation: csvStation ? csvStation.stationName : 'not found',
            firebaseStation: firebaseStation ? firebaseStation.stationName : 'not found',
            csvUserData: csvStation ? {
                isVisited: csvStation.isVisited,
                visitedDates: csvStation.visitedDates,
                isFavorite: csvStation.isFavorite,
                notes: csvStation.notes
            } : 'no csv station'
        });
        
        if (csvStation && firebaseStation) {
            
            // PRESERVE user's personal tracking data from CSV BEFORE updating with Firebase data
            const preservedUserData = {
                isVisited: csvStation.isVisited,
                visitedDates: csvStation.visitedDates,
                isFavorite: csvStation.isFavorite,
                notes: csvStation.notes
            };
            
            // Use Firebase document ID as the primary identifier
            csvStation.id = firebaseStation.id;
            
            // Update the CSV station with Firebase data
            csvStation.stationName = firebaseStation.stationName;
            csvStation.country = firebaseStation.country;
            csvStation.county = firebaseStation.county;
            csvStation.toc = firebaseStation.toc;
            csvStation.latitude = firebaseStation.latitude;
            csvStation.longitude = firebaseStation.longitude;
            csvStation.yearlyPassengers = firebaseStation.yearlyPassengers;
            csvStation.crsCode = firebaseStation.crsCode;
            csvStation.stnCrsId = firebaseStation.stnCrsId;
            csvStation.tiploc = firebaseStation.tiploc;
            
            // RESTORE user's personal tracking data from CSV (preserve user's original data)
            csvStation.isVisited = preservedUserData.isVisited;
            csvStation.visitedDates = preservedUserData.visitedDates;
            csvStation.isFavorite = preservedUserData.isFavorite;
            csvStation.notes = preservedUserData.notes;
            
            // Set matching metadata
            csvStation.matchedStation = firebaseStation;
            csvStation.isMatched = true;
            csvStation.matchConfidence = 1.0;
            
            // Move from unmatched to matched
            this.unmatchedStations = this.unmatchedStations.filter(s => s.id !== csvStationId);
            this.matchedStations.push(csvStation);
            
            console.log('Station linked successfully:', {
                finalStation: csvStation.stationName,
                finalUserData: {
                    isVisited: csvStation.isVisited,
                    visitedDates: csvStation.visitedDates,
                    isFavorite: csvStation.isFavorite,
                    notes: csvStation.notes
                }
            });
            
            // Update UI
            this.populateUnmatchedStations();
            // Don't update matched stations display on Review & Link page
            const resultsContainer = document.getElementById(`results-${csvStationId}`);
            if (resultsContainer) {
                resultsContainer.style.display = 'none';
            }
        }
    }

    exportResults() {
        this.goToStep(4);
    }


    downloadJSON() {
        // Create export data in the format expected by iOS app's StationExportService
        const exportData = {
            exportInfo: {
                exportedAt: new Date().toISOString(),
                format: "JSON",
                stationCount: this.matchedStations.length,
                options: {
                    includeLocalData: true,
                    includeFirebaseData: true,
                    includeYearlyPassengers: true,
                    includeCoordinates: true,
                    includeMetadata: true
                }
            },
            stations: [...this.matchedStations]
                .sort((a, b) => {
                    const nameA = (a.stationName || '').toLowerCase();
                    const nameB = (b.stationName || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                })
                .map(station => ({
                    id: station.id, // Now using Firebase station ID
                stationName: station.stationName,
                crsCode: station.crsCode,
                stnCrsId: station.stnCrsId,
                tiploc: station.tiploc,
                latitude: station.latitude,
                longitude: station.longitude,
                country: station.country,
                county: station.county,
                toc: station.toc,
                yearlyPassengers: station.yearlyPassengers,
                    // Personal tracking data preserved from CSV
                isVisited: station.isVisited,
                visitedDates: station.visitedDates,
                isFavorite: station.isFavorite,
                notes: station.notes
            }))
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `railstats_stations_${this.getTimestamp()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadCSV() {
        // Generate CSV content using the same format as iOS app
        const csvContent = this.generateCSVContent();
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `railstats_stations_${this.getTimestamp()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateCSVContent() {
        const csvLines = [];
        
        // Generate header row (matching iOS app format)
        const headers = this.generateCSVHeaders();
        csvLines.push(headers.join(','));
        
        // Sort stations alphabetically by station name for consistent export order
        const sortedStations = [...this.matchedStations].sort((a, b) => {
            const nameA = (a.stationName || '').toLowerCase();
            const nameB = (b.stationName || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        // Generate data rows
        for (const station of sortedStations) {
            const row = this.generateCSVRow(station);
            csvLines.push(row.join(','));
        }
        
        return csvLines.join('\n');
    }

    generateCSVHeaders() {
        // Match the exact headers from StationExportService.swift
        const headers = [
            'Station ID',
            'CRS Code',
            'TIPLOC',
            'Station Name',
            'Country',
            'County',
            'TOC',
            'Latitude',
            'Longitude',
            'Is Visited',
            'Visit Dates',
            'Is Favorite'
        ];
        
        // Add yearly passenger columns (2024 down to 1998) - matching iOS app
        for (let year = 2024; year >= 1998; year--) {
            headers.push(year.toString());
        }
        
        return headers;
    }

    generateCSVRow(station) {
        
        // Format visit dates like iOS app (semicolon-separated, yyyy-MM-dd format)
        const visitDatesString = station.visitedDates && station.visitedDates.length > 0 
            ? station.visitedDates.map(date => this.formatDateForCSV(date)).join(';')
            : '';
        
        // Ensure coordinates are properly formatted as numbers
        const latitude = typeof station.latitude === 'number' ? station.latitude : 0;
        const longitude = typeof station.longitude === 'number' ? station.longitude : 0;
        
        const row = [
            this.escapeCSVField(station.id), // Use unique CSV station ID instead of Firebase station ID
            this.escapeCSVField(station.crsCode),
            this.escapeCSVField(station.tiploc || ''),
            this.escapeCSVField(station.stationName),
            this.escapeCSVField(station.country || ''),
            this.escapeCSVField(station.county || ''),
            this.escapeCSVField(station.toc || ''),
            latitude.toString(),
            longitude.toString(),
            station.isVisited ? 'Yes' : 'No',
            this.escapeCSVField(visitDatesString),
            station.isFavorite ? 'Yes' : 'No'
        ];
        
        // Add yearly passenger data (2024 down to 1998)
        for (let year = 2024; year >= 1998; year--) {
            const yearString = year.toString();
            if (station.yearlyPassengers && station.yearlyPassengers[yearString] !== undefined) {
                const passengers = station.yearlyPassengers[yearString];
                row.push(passengers !== null ? passengers.toString() : 'N/A');
            } else {
                row.push('N/A');
            }
        }
        
        return row;
    }

    escapeCSVField(field) {
        // Escape CSV fields like iOS app does
        const needsQuotes = field.includes(',') || field.includes('"') || field.includes('\n');
        if (needsQuotes) {
            const escaped = field.replace(/"/g, '""');
            return `"${escaped}"`;
        }
        return field;
    }

    formatDateForCSV(date) {
        // Format dates as yyyy-MM-dd (matching iOS app's exportDateFormatter)
        if (date instanceof Date) {
            return date.toISOString().split('T')[0];
        } else if (typeof date === 'string') {
            // If it's already a string, try to parse and reformat
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString().split('T')[0];
            }
        }
        return '';
    }

    getTimestamp() {
        // Generate timestamp like iOS app (yyyyMMdd_HHmmss)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }

    // UI Helper Methods
    goToStep(step) {
        // Hide all steps
        const allSections = document.querySelectorAll('.step-section');
        if (allSections.length === 0) {
            console.error('No step sections found in DOM');
            return;
        }
        
        allSections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Show current step
        const stepNames = ['upload', 'review', 'matching', 'review-matches', 'export'];
        const stepName = stepNames[step - 1] || 'upload';
        const targetSection = document.getElementById(`${stepName}-section`);
        
        if (targetSection) {
            targetSection.classList.add('active');
        } else {
            console.error(`Step section not found: ${stepName}-section`);
        }
        
        this.currentStep = step;
        
        // Populate data for specific steps
        if (step === 4) {
            // Clear matched stations section since we only want to show unmatched ones
            const matchedContainer = document.getElementById('matched-stations');
            if (matchedContainer) {
                matchedContainer.innerHTML = '';
            }
            this.populateUnmatchedStations();
        }
    }

    showLoading(text = 'Processing...') {
        const loadingText = document.getElementById('loading-text');
        const loadingOverlay = document.getElementById('loading-overlay');
        
        if (loadingText) loadingText.textContent = text;
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }

    showError(message) {
        const errorMessage = document.getElementById('error-message');
        const errorModal = document.getElementById('error-modal');
        
        if (errorMessage) errorMessage.textContent = message;
        if (errorModal) errorModal.style.display = 'flex';
    }

    startOver() {
        this.uploadedStations = [];
        this.matchedStations = [];
        this.unmatchedStations = [];
        this.currentStep = 1;
        this.isProcessingFile = false;
        this.matchingLog = [];
        this.logStats = {
            matched: 0,
            unmatched: 0,
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0
        };
        
        // Reset UI
        const fileInfo = document.getElementById('file-info');
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const matchingLog = document.getElementById('matching-log');
        
        if (fileInfo) fileInfo.style.display = 'none';
        if (uploadArea) uploadArea.style.display = 'block';
        if (fileInput) fileInput.value = '';
        if (matchingLog) matchingLog.style.display = 'none';
        
        this.goToStep(1);
    }
}

// Global functions for HTML onclick handlers
function removeFile() {
    const fileInfo = document.getElementById('file-info');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    if (fileInfo) fileInfo.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    if (fileInput) fileInput.value = '';
}

function startMatching() {
    migrationTool.startMatching();
}

function goToStep(step) {
    migrationTool.goToStep(step);
}

function exportResults() {
    migrationTool.exportResults();
}

function downloadJSON() {
    migrationTool.downloadJSON();
}

function downloadCSV() {
    migrationTool.downloadCSV();
}

function startOver() {
    migrationTool.startOver();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleMatchingLog() {
    const logContent = document.getElementById('log-content');
    const logToggle = document.getElementById('log-toggle');
    
    if (logContent && logToggle) {
        const isCollapsed = logContent.classList.contains('collapsed');
        
        if (isCollapsed) {
            logContent.classList.remove('collapsed');
            logToggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
        } else {
            logContent.classList.add('collapsed');
            logToggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
        }
    }
}

// Initialize the migration tool when the page loads
let migrationTool;
document.addEventListener('DOMContentLoaded', () => {
    migrationTool = new MigrationTool();
});


