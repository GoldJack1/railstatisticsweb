// Matching page controller
class MatchingController {
    constructor() {
        this.uploadedStations = [];
        this.firebaseStations = [];
        this.matchedStations = [];
        this.matchingLog = [];
        this.logStats = {
            matched: 0,
            unmatched: 0,
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0
        };
        this.init();
    }

    init() {
        this.loadData();
        this.initializeEventListeners();
        this.startMatching();
    }

    loadData() {
        const data = window.storageService.loadMigrationData();
        if (!data || !data.uploadedStations) {
            // No data found, redirect to upload page
            window.location.href = 'upload.html';
            return;
        }

        this.uploadedStations = data.uploadedStations;
    }

    initializeEventListeners() {
        // Initialize Firebase
        this.initializeFirebase();
    }

    async initializeFirebase() {
        try {
            await window.firebaseService.initialize();
            this.firebaseStations = await window.firebaseService.fetchStations();
            console.log(`Loaded ${this.firebaseStations.length} Firebase stations`);
        } catch (error) {
            console.error('Error loading Firebase stations:', error);
            this.showError('Failed to load station database from Firebase. Please check your connection and try again.');
        }
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
            // Wait for Firebase to be ready
            if (this.firebaseStations.length === 0) {
                await this.initializeFirebase();
            }
            
            const results = await window.stationMatcher.performFuzzyMatching(this.uploadedStations, this.firebaseStations);
            
            this.matchedStations = results.matchedStations;
            this.matchingLog = results.matchingLog;
            this.logStats = results.logStats;
            
            // Save results to storage
            window.storageService.saveMigrationData({
                uploadedStations: this.uploadedStations,
                matchedStations: this.matchedStations,
                matchingLog: this.matchingLog,
                logStats: this.logStats
            });
            
            this.hideLoading();
            this.showMatchingResults();
            
        } catch (error) {
            this.hideLoading();
            console.error('Error during matching:', error);
            this.showError('Error during station matching. Please try again.');
        }
    }

    showMatchingResults() {
        const matchedCount = document.getElementById('matched-count');
        const unmatchedCount = document.getElementById('unmatched-count');
        const matchingResults = document.getElementById('matching-results');
        const continueBtn = document.getElementById('continue-btn');
        
        if (matchedCount) matchedCount.textContent = this.matchedStations.length;
        if (unmatchedCount) unmatchedCount.textContent = this.logStats.unmatched; // Show skipped stations
        if (matchingResults) matchingResults.style.display = 'block';
        if (continueBtn) {
            continueBtn.style.display = 'block';
        }
        
        // Render matching log
        this.renderMatchingLog();
        
        // Automatically proceed to export after a delay
        setTimeout(() => {
            this.continueToExport();
        }, 3000);
    }

    renderMatchingLog() {
        const logEntries = document.getElementById('log-entries');
        const logStats = document.querySelector('.log-stats');
        
        if (logEntries) {
            logEntries.innerHTML = '';
            
            this.matchingLog.slice(-20).forEach(logEntry => {
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
            });
        }
        
        if (logStats) {
            logStats.innerHTML = `
                <div class="log-stat">
                    <div class="log-stat-icon success">✓</div>
                    <span>Matched: ${this.logStats.matched}</span>
                </div>
                <div class="log-stat">
                    <div class="log-stat-icon warning">⚠</div>
                    <span>Skipped: ${this.logStats.unmatched}</span>
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
    window.location.href = 'review.html';
}

function continueToExport() {
    window.location.href = 'export.html';
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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize the matching controller when the page loads
let matchingController;
document.addEventListener('DOMContentLoaded', () => {
    matchingController = new MatchingController();
});
