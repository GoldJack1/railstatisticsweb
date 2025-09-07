// CSV Parser shared module
class CSVParser {
    constructor() {
        this.supportedFormats = ['original', 'oldformatv2', 'exported3'];
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

        const stations = [];
        let skippedLines = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const values = this.parseCSVLine(line);
                
                if (values.length < 5) {
                    console.warn(`Skipping line ${i + 1}: insufficient columns (${values.length})`);
                    skippedLines++;
                    continue;
                }
                
                const station = this.createStationFromCSVRow(headers, values, csvFormat);
                stations.push(station);
                
                if (i % 100 === 0) {
                    console.log(`Parsed ${i} lines...`);
                }
                
            } catch (error) {
                console.warn(`Error parsing line ${i + 1}:`, error.message);
                skippedLines++;
                continue;
            }
        }

        console.log(`Parsed ${stations.length} stations (skipped ${skippedLines} lines)`);
        return stations;
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
                    currentField += '"';
                    i += 2;
                } else {
                    insideQuotes = !insideQuotes;
                    i++;
                }
            } else if (char === ',' && !insideQuotes) {
                result.push(currentField.trim());
                currentField = '';
                i++;
            } else {
                currentField += char;
                i++;
            }
        }
        
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
            visitedDates: [],
            isFavorite: false,
            latitude: null,
            longitude: null,
            yearlyPassengers: {},
            csvType: null,
            matchedStation: null,
            matchConfidence: 0,
            isMatched: false
        };

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
                    if (value.includes(';')) {
                        station.visitedDates = value.split(';').map(dateStr => this.parseVisitDate(dateStr.trim())).filter(date => date !== null);
                    } else {
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
            }
        }

        return station;
    }

    parseVisitDate(dateString) {
        if (!dateString) return null;
        
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
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
}

// Create global instance
window.csvParser = new CSVParser();
