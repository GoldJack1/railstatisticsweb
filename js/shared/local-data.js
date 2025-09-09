// Local Data Service
// This service provides local station data for development and testing
class LocalDataService {
    constructor() {
        this.stations = null;
        this.stats = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log('Loading local station data...');
            
            // Try to load from local JSON file
            const response = await fetch('./data/stations.json');
            if (response.ok) {
                this.stations = await response.json();
                console.log(`Loaded ${this.stations.length} stations from local data file`);
                
                // Load stats if available
                try {
                    const statsResponse = await fetch('./data/stats.json');
                    if (statsResponse.ok) {
                        this.stats = await statsResponse.json();
                        console.log('Loaded statistics from local data file');
                    }
                } catch (error) {
                    console.warn('Could not load stats file:', error);
                }
            } else {
                console.warn('Could not load local data file, using empty array');
                this.stations = [];
            }
            
            this.isInitialized = true;
            console.log('Local data service initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize local data service:', error);
            this.stations = [];
            this.isInitialized = true;
        }
    }

    async fetchStations() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log(`Returning ${this.stations.length} stations from local data`);
        return [...this.stations]; // Return a copy to prevent mutations
    }

    getStats() {
        if (this.stats) {
            return this.stats;
        }

        if (!this.stations) {
            return {
                totalStations: 0,
                withCoordinates: 0,
                withTOC: 0,
                withPassengers: 0
            };
        }

        return {
            totalStations: this.stations.length,
            withCoordinates: this.stations.filter(s => s.latitude !== 0 && s.longitude !== 0).length,
            withTOC: this.stations.filter(s => s.toc && s.toc.trim() !== '').length,
            withPassengers: this.stations.filter(s => s.yearlyPassengers && 
                (typeof s.yearlyPassengers === 'number' || 
                 (typeof s.yearlyPassengers === 'object' && Object.keys(s.yearlyPassengers).length > 0))).length
        };
    }

    hasData() {
        return this.stations && this.stations.length > 0;
    }

    getDataInfo() {
        return {
            hasData: this.hasData(),
            stationCount: this.stations ? this.stations.length : 0,
            source: this.stats ? this.stats.source : 'Local Data',
            downloadDate: this.stats ? this.stats.downloadDate : null
        };
    }
}

// Create global instance
window.localDataService = new LocalDataService();
