# Rail Statistics Migration System

## Overview

The migration system has been redesigned as a multi-page application with separate pages for each step of the migration process. This provides better user experience, cleaner code organization, and easier maintenance.

## Architecture

### Page Structure

1. **index.html** - Entry point that redirects to upload.html
2. **upload.html** - Step 1: File upload and CSV parsing
3. **review.html** - Step 2: Data preview and validation
4. **matching.html** - Step 3: Station matching with Firebase
5. **export.html** - Step 4: Download results
6. **test.html** - System testing page

### Shared Modules

Located in `js/shared/`:

- **firebase.js** - Firebase service for database operations
- **csv-parser.js** - CSV parsing and format detection
- **storage.js** - Local storage for data persistence between pages
- **matcher.js** - Station matching algorithms
- **exporter.js** - File export functionality

### Page Controllers

Located in `js/pages/`:

- **upload.js** - Upload page controller
- **review.js** - Review page controller
- **matching.js** - Matching page controller
- **export.js** - Export page controller

## Data Flow

1. **Upload Page**: User uploads CSV file, data is parsed and stored in localStorage
2. **Review Page**: Data is loaded from storage, displayed for user review
3. **Matching Page**: Firebase stations are loaded, matching is performed, results stored
4. **Export Page**: Final data is loaded and exported as CSV/JSON

## Key Features

### Simplified Matching
- **Only matched stations are included**: Stations that don't match with Firebase are completely skipped
- **No manual review needed**: Eliminates the need for manual station linking
- **Cleaner results**: Only stations with valid Firebase data are exported

### Data Persistence
- All migration data is stored in localStorage
- Users can navigate between pages without losing progress
- Data persists across browser sessions (24-hour expiry)

### Error Handling
- Each page has its own error handling
- Graceful fallbacks for missing data
- User-friendly error messages

### Navigation
- Automatic redirects between pages
- Back/forward navigation support
- Data validation before page transitions

## Usage

1. Start at `index.html` (redirects to `upload.html`)
2. Upload your CSV file
3. Review the parsed data
4. Wait for station matching to complete
5. Download your migrated data

## Testing

Use `test.html` to verify all shared modules are working correctly.

## Configuration

### Firebase
- Environment variables are used in production
- `firebase-config.js` provides fallback for local development
- Configuration is loaded dynamically in the Firebase service

### Storage
- Uses localStorage with automatic cleanup
- 24-hour data expiry
- Session tracking for user experience

## Migration from Old System

The old single-page system (`migration.js`) has been replaced with this modular approach. The original file is preserved for reference but is no longer used.

## Benefits

1. **Better UX**: Each step has its own focused page
2. **Cleaner Code**: Separation of concerns with shared modules
3. **Easier Maintenance**: Individual page controllers
4. **Better Performance**: Only load what's needed for each step
5. **Data Persistence**: Users can resume where they left off
6. **Error Isolation**: Errors on one page don't affect others
7. **Simplified Results**: Only stations with valid Firebase matches are included
8. **No Manual Review**: Eliminates the need for manual station linking
