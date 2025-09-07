// Review page controller
class ReviewController {
    constructor() {
        this.uploadedStations = [];
        this.init();
    }

    init() {
        this.loadData();
        this.initializeEventListeners();
    }

    loadData() {
        const data = window.storageService.loadMigrationData();
        if (!data || !data.uploadedStations) {
            // No data found, redirect to upload page
            window.location.href = 'upload.html';
            return;
        }

        this.uploadedStations = data.uploadedStations;
        this.updateDataSummary();
        this.populatePreviewTable();
    }

    initializeEventListeners() {
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
    window.location.href = 'upload.html';
}

function continueToMatching() {
    window.location.href = 'matching.html';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize the review controller when the page loads
let reviewController;
document.addEventListener('DOMContentLoaded', () => {
    reviewController = new ReviewController();
});
