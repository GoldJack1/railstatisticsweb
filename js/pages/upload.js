// Upload page controller
class UploadController {
    constructor() {
        this.isProcessingFile = false;
        this.uploadedStations = [];
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.checkForExistingData();
    }

    initializeEventListeners() {
        // File upload
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');
        
        if (fileInput) {
            fileInput.setAttribute('accept', '.csv,.txt');
            fileInput.style.display = 'none';
            fileInput.disabled = false;
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
        }
        
        if (uploadArea) {
            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
            
            // Click to upload
            uploadArea.addEventListener('click', (e) => {
                const currentFileInput = document.getElementById('file-input');
                if (currentFileInput) {
                    currentFileInput.click();
                }
            });
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
    }

    checkForExistingData() {
        // Check if there's existing data from a previous session
        const existingData = window.storageService.loadMigrationData();
        if (existingData && existingData.uploadedStations) {
            this.showExistingDataWarning(existingData);
        }
    }

    showExistingDataWarning(data) {
        const summary = window.storageService.getDataSummary();
        if (summary) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'existing-data-warning';
            warningDiv.innerHTML = `
                <div class="warning-content">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <h4>Existing Migration Data Found</h4>
                        <p>You have ${summary.total} stations from a previous session. You can continue with this data or upload a new file.</p>
                        <div class="warning-actions">
                            <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Upload New File</button>
                            <button class="btn btn-primary" onclick="window.location.href='review.html'">Continue with Existing Data</button>
                        </div>
                    </div>
                </div>
            `;
            
            const mainContent = document.querySelector('.main-content');
            mainContent.insertBefore(warningDiv, mainContent.firstChild);
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
        this.showLoading('Processing CSV file...');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                console.log('File loaded, starting CSV parsing...');
                this.uploadedStations = window.csvParser.parseCSV(e.target.result);
                
                // Save data to storage
                window.storageService.saveMigrationData({
                    uploadedStations: this.uploadedStations,
                    fileName: file.name,
                    fileSize: file.size
                });
                
                this.hideLoading();
                this.enableContinueButton();
                
            } catch (error) {
                console.error('Error parsing CSV:', error);
                this.hideLoading();
                this.showError(`Error parsing CSV file: ${error.message}. Please check the format and try again.`);
            } finally {
                this.isProcessingFile = false;
            }
        };
        
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            this.hideLoading();
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

    enableContinueButton() {
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.disabled = false;
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
function removeFile() {
    const fileInfo = document.getElementById('file-info');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const continueBtn = document.getElementById('continue-btn');
    
    if (fileInfo) fileInfo.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    if (fileInput) fileInput.value = '';
    if (continueBtn) continueBtn.disabled = true;
    
    // Clear stored data
    window.storageService.clearMigrationData();
}

function continueToReview() {
    window.location.href = 'review.html';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize the upload controller when the page loads
let uploadController;
document.addEventListener('DOMContentLoaded', () => {
    uploadController = new UploadController();
});
