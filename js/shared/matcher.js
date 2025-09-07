// Station matching service
class StationMatcher {
    constructor() {
        this.fuzzyMatchThreshold = 0.5;
        this.matchingLog = [];
        this.logStats = {
            matched: 0,
            unmatched: 0,
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0
        };
    }

    async performFuzzyMatching(uploadedStations, firebaseStations, progressCallback = null) {
        console.log('Starting fuzzy matching...');
        console.log('Uploaded stations:', uploadedStations.length);
        console.log('Firebase stations:', firebaseStations.length);
        
        if (firebaseStations.length === 0) {
            throw new Error('No station database loaded. Please check your Firebase connection.');
        }
        
        const matchedStations = [];
        
        // Track which Firebase stations have already been matched to prevent duplicates
        const usedFirebaseStations = new Set();
        
        const total = uploadedStations.length;
        let processed = 0;
        
        for (const csvStation of uploadedStations) {
            const bestMatch = this.findBestMatch(csvStation, firebaseStations);
            
            // Only include stations that successfully match with Firebase
            if (bestMatch.match && bestMatch.confidence >= this.fuzzyMatchThreshold) {
                // Check if this Firebase station has already been matched to prevent duplicates
                if (usedFirebaseStations.has(bestMatch.match.id)) {
                    console.warn(`Firebase station ${bestMatch.match.stationName} (${bestMatch.match.id}) already matched, skipping duplicate`);
                    this.addLogEntry('warning', csvStation, bestMatch.match, bestMatch.confidence, 'Duplicate match prevented');
                    this.logStats.unmatched++;
                } else {
                    // Mark this Firebase station as used
                    usedFirebaseStations.add(bestMatch.match.id);
                
                    // Update the CSV station with Firebase data while preserving CSV user data
                    csvStation.id = bestMatch.match.id;
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
                    
                    // Set matching metadata
                    csvStation.matchedStation = bestMatch.match;
                    csvStation.matchConfidence = bestMatch.confidence;
                    csvStation.isMatched = true;
                    matchedStations.push(csvStation);
                    
                    // Log successful match
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
                // Skip unmatched stations completely - don't include them in results
                console.log(`Skipping unmatched station: ${csvStation.stationName}`);
                this.addLogEntry('info', csvStation, null, 0.0, 'Station skipped - no match found');
                this.logStats.unmatched++;
            }
            
            processed++;
            
            // Update progress if callback provided
            if (progressCallback) {
                const percentage = Math.round((processed / total) * 100);
                progressCallback(percentage, processed, total);
            }
            
            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Clean up matched stations - remove additional fields used only for matching
        const cleanedStations = this.cleanMatchedStations(matchedStations);
        
        console.log(`Matching complete: ${cleanedStations.length} stations matched, ${this.logStats.unmatched} stations skipped`);
        
        return {
            matchedStations: cleanedStations,
            matchingLog: this.matchingLog,
            logStats: this.logStats
        };
    }

    cleanMatchedStations(matchedStations) {
        // Remove additional fields that were only used for matching
        // Keep only the essential fields: stationName, isVisited, visitedDates, isFavorite
        // Plus the Firebase data: crsCode, latitude, longitude, country, county, toc
        return matchedStations.map(station => {
            const cleaned = {
                id: station.id,
                stationName: station.stationName,
                isVisited: station.isVisited,
                visitedDates: station.visitedDates,
                isFavorite: station.isFavorite,
                // Firebase data from matching
                crsCode: station.crsCode,
                latitude: station.latitude,
                longitude: station.longitude,
                country: station.country,
                county: station.county,
                toc: station.toc,
                // Matching metadata
                matchedStation: station.matchedStation,
                matchConfidence: station.matchConfidence,
                isMatched: station.isMatched
            };
            return cleaned;
        });
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
        if (csvCoreName !== csvName) {
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
                if (nameSimilarity > 0.5 && nameSimilarity > bestConfidence) {
                    bestConfidence = nameSimilarity;
                    bestMatch = firebaseStation;
                }
            }
        }
        
        // Strategy 5: Last resort - very lenient name matching
        if (bestConfidence < 0.4) {
            for (const firebaseStation of firebaseStations) {
                const nameSimilarity = this.calculateStringSimilarity(csvStation.stationName, firebaseStation.stationName);
                if (nameSimilarity > 0.3 && nameSimilarity > bestConfidence) {
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
        
        // Check if either string contains the other
        if (s1.includes(s2) || s2.includes(s1)) {
            return 0.9;
        }
        
        // Try core name matching
        const core1 = this.extractCoreStationName(s1);
        const core2 = this.extractCoreStationName(s2);
        
        if (core1 !== s1 || core2 !== s2) {
            if (core1 === core2) {
                return 0.95;
            }
            
            if (core1.includes(core2) || core2.includes(core1)) {
                return 0.9;
            }
            
            const coreSimilarity = this.calculateCoreSimilarity(core1, core2);
            if (coreSimilarity > 0.8) {
                return coreSimilarity;
            }
        }
        
        // Levenshtein distance based similarity
        const distance = this.levenshteinDistance(s1, s2);
        const maxLength = Math.max(s1.length, s2.length);
        const fullSimilarity = maxLength === 0 ? 0.0 : 1.0 - (distance / maxLength);
        
        const coreSimilarity = this.calculateCoreSimilarity(core1, core2);
        
        return Math.max(fullSimilarity, coreSimilarity);
    }

    extractCoreStationName(stationName) {
        const locationPatterns = [
            /\([A-Z]{3}\)/g,
            /\([A-Za-z\s]+shire\)/g,
            /\([A-Za-z\s]+shire\s+[A-Za-z]+\)/g,
            /\([A-Za-z\s]+\s+County\)/g,
            /\([A-Za-z\s]+\s+City\)/g,
            /\([A-Za-z\s]+\s+District\)/g,
            /\([A-Za-z\s]+\s+Borough\)/g,
            /\(Herts\)/g,
            /\(Herts\.\)/g,
            /\(Hertfordshire\)/g,
            /\(West\s+Yorkshire\)/g,
            /\(East\s+Yorkshire\)/g,
            /\(South\s+Yorkshire\)/g,
            /\(North\s+Yorkshire\)/g,
            /\(Greater\s+London\)/g,
            /\(Greater\s+Manchester\)/g
        ];
        
        let result = stationName;
        
        for (const pattern of locationPatterns) {
            result = result.replace(pattern, '').trim();
        }
        
        return result;
    }

    extractCRSCode(stationName) {
        const match = stationName.match(/\(([A-Z]{3})\)/);
        return match ? match[1] : null;
    }

    calculateCoreSimilarity(core1, core2) {
        const variations1 = this.generateNameVariations(core1);
        const variations2 = this.generateNameVariations(core2);
        
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
        
        const distance = this.levenshteinDistance(core1, core2);
        const maxLength = Math.max(core1.length, core2.length);
        return maxLength === 0 ? 0.0 : 1.0 - (distance / maxLength);
    }

    generateNameVariations(name) {
        const variations = [name];
        
        const commonWords = ['station', 'railway', 'rail', 'junction', 'central', 'north', 'south', 'east', 'west'];
        
        for (const word of commonWords) {
            const withoutWord = name.replace(new RegExp(word, 'gi'), '').trim();
            if (withoutWord && withoutWord !== name) {
                variations.push(withoutWord);
            }
        }
        
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
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
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
        
        // Keep only last 100 entries for performance
        if (this.matchingLog.length > 100) {
            this.matchingLog.shift();
        }
    }
}

// Create global instance
window.stationMatcher = new StationMatcher();
