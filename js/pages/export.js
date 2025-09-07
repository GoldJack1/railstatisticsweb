// Export page controller
class ExportController {
    constructor() {
        this.matchedStations = [];
        this.init();
    }

    init() {
        this.loadData();
        this.updateExportSummary();
    }

    loadData() {
        const data = window.storageService.loadMigrationData();
        if (!data || !data.matchedStations) {
            // No data found, redirect to upload page
            window.location.href = 'upload.html';
            return;
        }

        this.matchedStations = data.matchedStations;
    }

    updateExportSummary() {
        const total = this.matchedStations.length;
        const visited = this.matchedStations.filter(s => s.isVisited).length;
        const favorites = this.matchedStations.filter(s => s.isFavorite).length;
        
        const totalElement = document.getElementById('total-stations');
        const favoriteElement = document.getElementById('favorite-stations');
        const visitedElement = document.getElementById('visited-stations');
        
        if (totalElement) totalElement.textContent = total;
        if (favoriteElement) favoriteElement.textContent = favorites;
        if (visitedElement) visitedElement.textContent = visited;
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
}

// Global functions for HTML onclick handlers
function goBack() {
    window.location.href = 'matching.html';
}

function startOver() {
    // Clear all stored data
    window.storageService.clearMigrationData();
    // Redirect to upload page
    window.location.href = 'upload.html';
}

function downloadCSV() {
    const data = window.storageService.loadMigrationData();
    if (!data || !data.matchedStations) {
        alert('No data available for export. Please complete the migration process first.');
        return;
    }
    
    try {
        window.exportService.downloadCSV(data.matchedStations);
    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Error generating CSV file. Please try again.');
    }
}

function downloadJSON() {
    const data = window.storageService.loadMigrationData();
    if (!data || !data.matchedStations) {
        alert('No data available for export. Please complete the migration process first.');
        return;
    }
    
    try {
        window.exportService.downloadJSON(data.matchedStations);
    } catch (error) {
        console.error('Error downloading JSON:', error);
        alert('Error generating JSON file. Please try again.');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize the export controller when the page loads
let exportController;
document.addEventListener('DOMContentLoaded', () => {
    exportController = new ExportController();
});
