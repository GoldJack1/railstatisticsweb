// Storage service for persisting data between pages
class StorageService {
    constructor() {
        this.storageKey = 'railstatistics_migration_data';
        this.sessionKey = 'railstatistics_migration_session';
    }

    // Save migration data to localStorage
    saveMigrationData(data) {
        try {
            const dataToSave = {
                ...data,
                timestamp: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
            console.log('Migration data saved to localStorage');
        } catch (error) {
            console.error('Error saving migration data:', error);
        }
    }

    // Load migration data from localStorage
    loadMigrationData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                console.log('Migration data loaded from localStorage');
                return parsed;
            }
        } catch (error) {
            console.error('Error loading migration data:', error);
        }
        return null;
    }

    // Clear migration data
    clearMigrationData() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.sessionKey);
            console.log('Migration data cleared from localStorage');
        } catch (error) {
            console.error('Error clearing migration data:', error);
        }
    }

    // Save current session info
    saveSessionInfo(sessionInfo) {
        try {
            const sessionData = {
                ...sessionInfo,
                timestamp: Date.now()
            };
            localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        } catch (error) {
            console.error('Error saving session info:', error);
        }
    }

    // Load current session info
    loadSessionInfo() {
        try {
            const data = localStorage.getItem(this.sessionKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading session info:', error);
        }
        return null;
    }

    // Check if data exists and is recent (within 24 hours)
    hasValidData() {
        const data = this.loadMigrationData();
        if (!data || !data.timestamp) {
            return false;
        }
        
        const twentyFourHours = 24 * 60 * 60 * 1000;
        return (Date.now() - data.timestamp) < twentyFourHours;
    }

    // Get data summary for display
    getDataSummary() {
        const data = this.loadMigrationData();
        if (!data) {
            return null;
        }

        const stations = data.uploadedStations || [];
        return {
            total: stations.length,
            visited: stations.filter(s => s.isVisited).length,
            favorites: stations.filter(s => s.isFavorite).length,
            matched: data.matchedStations ? data.matchedStations.length : 0
        };
    }
}

// Create global instance
window.storageService = new StorageService();
