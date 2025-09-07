// Export service for generating downloadable files
class ExportService {
    constructor() {
        this.exportFormats = ['csv', 'json'];
    }

    downloadJSON(stations) {
        // Create export data in the format expected by iOS app's StationExportService
        const exportData = {
            exportInfo: {
                exportedAt: new Date().toISOString(),
                format: "JSON",
                stationCount: stations.length,
                options: {
                    includeLocalData: true,
                    includeFirebaseData: true,
                    includeYearlyPassengers: true,
                    includeCoordinates: true,
                    includeMetadata: true
                }
            },
            stations: [...stations]
                .sort((a, b) => {
                    const nameA = (a.stationName || '').toLowerCase();
                    const nameB = (b.stationName || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                })
                .map(station => ({
                    id: station.id,
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

    downloadCSV(stations) {
        // Generate CSV content using the same format as iOS app
        const csvContent = this.generateCSVContent(stations);
        
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

    generateCSVContent(stations) {
        const csvLines = [];
        
        // Generate header row (matching iOS app format)
        const headers = this.generateCSVHeaders();
        csvLines.push(headers.join(','));
        
        // Sort stations alphabetically by station name for consistent export order
        const sortedStations = [...stations].sort((a, b) => {
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
            this.escapeCSVField(station.id),
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
}

// Create global instance
window.exportService = new ExportService();
