# Rail Statistics - Web Migration Tool

A powerful web-based tool for migrating station tracking data from CSV files to the Rail Statistics app format.

## Features

- **Multi-format CSV Support**: Handles original, oldformatv2, and exported3 CSV formats
- **Advanced Fuzzy Matching**: Uses multiple algorithms to automatically match stations
- **Interactive Review**: Manual linking interface for unmatched stations
- **Multiple Export Options**: QR code, JSON, and CSV export formats
- **Real-time Processing**: Live progress updates and instant feedback
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## How to Use

### 1. Upload CSV File
- Drag and drop your CSV file onto the upload area, or click to browse
- Supported formats: Original, oldformatv2, exported3
- The tool will automatically detect the CSV format

### 2. Review Parsed Data
- Check the data summary and preview table
- Use search and filters to review your station data
- Verify that all data has been parsed correctly

### 3. Station Matching
- Click "Start Matching" to begin the automatic matching process
- The tool will match your stations against the Firebase database
- Progress is shown in real-time
- **Data Merging**: Station information (name, location, TOC) is updated from Firebase while personal tracking data (visits, favorites) is preserved from your CSV file

### 4. Manual Review (if needed)
- Review any stations that couldn't be automatically matched
- Search for the correct station and link manually
- All matched stations will be ready for export

### 5. Export Results
Choose from three export options:
- **Import to App**: Generate a QR code to scan with your Rail Statistics app
- **Download JSON**: Get a JSON file for manual import (compatible with iOS app)
- **Download CSV**: Get a processed CSV file (compatible with iOS app's StationImportService)

**Export Format Compatibility:**
- CSV exports use the exact same format as your iOS app's `StationExportService`
- JSON exports match the structure expected by `StationImportService`
- All exports preserve your personal tracking data from the uploaded CSV (visits, favorites, notes)
- Station information is updated with current Firebase data (names, locations, TOC)
- Files are named with timestamps: `railstats_stations_YYYYMMDD_HHMMSS.csv/json`

## CSV Format Support

### Original Format
```csv
Station,Country,County,TOC,Visited,Latitude,Longitude,2024,2023,...
```

### oldformatv2 Format
```csv
Type,Station,Country,County,Operator,Visited,Visit Date DD/MM/YYYY,Favourite,Latitude,Longitude,...
```

### exported3 Format
```csv
Station Name,Country,County,Operator,Visited,Visit Date,Favorite,Latitude,Longitude,...
```

## Technical Details

### Fuzzy Matching Algorithms
The tool uses multiple matching strategies:

1. **Exact CRS Code Match**: Highest priority for stations with CRS codes
2. **Exact Name Match**: Direct name comparison
3. **Comprehensive Matching**: Weighted scoring based on:
   - Name similarity (40%)
   - CRS code match (25%)
   - TOC/Operator match (15%)
   - Country match (10%)
   - County match (5%)
   - Location proximity (5%)
4. **Fuzzy Name Matching**: Levenshtein distance for similar names

### Performance
- Processes thousands of stations efficiently
- Real-time progress updates
- Optimized algorithms for fast matching
- Memory-efficient processing

## Integration with iOS App

### QR Code Import
1. Generate QR code in the web tool
2. Open Rail Statistics app
3. Use "Import from Website" feature
4. Scan the QR code
5. Data is automatically imported

### JSON Import
1. Download JSON file from web tool
2. Transfer to your iOS device
3. Use app's "Import JSON" feature
4. Select the downloaded file

## Deployment

### Local Development
1. Clone the repository: `git clone https://github.com/GoldJack1/railstatisticsweb.git`
2. Navigate to the directory: `cd railstatisticsweb`
3. Start a local server:
   - Python 3: `python3 -m http.server 8000`
   - Python 2: `python -m SimpleHTTPServer 8000`
   - Node.js: `npx serve .`
4. Open `http://localhost:8000` in your browser
5. All files must be served from the same directory (not opened directly as file://)

### Netlify Deployment (Recommended)
1. Fork or clone this repository
2. Set up your Firebase configuration (see Firebase Setup below)
3. Connect your GitHub repository to Netlify:
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Choose GitHub and select your repository
   - Build settings:
     - Build command: `echo 'No build step required'`
     - Publish directory: `.` (root directory)
4. Deploy! Your site will be available at `https://your-site-name.netlify.app`

### Manual Web Hosting
1. Upload all files to your web server
2. Ensure proper MIME types for CSS and JS files
3. HTTPS recommended for production use
4. Make sure to configure your Firebase settings

### Firebase Setup
To connect with your actual Firebase database:

1. **Get your Firebase config:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings > General > Your apps
   - Add a web app if you haven't already
   - Copy the config object

2. **Set up the configuration:**
   - Copy `firebase-config.template.js` to `firebase-config.js`
   - Replace the placeholder values with your actual Firebase config
   - Save the file
   - **Important:** `firebase-config.js` is in `.gitignore` to keep your credentials secure

3. **Set up Firestore security rules:**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /stations/{document} {
         allow read: if true; // Allow public read access for migration tool
       }
     }
   }
   ```

4. **For Netlify deployment:**
   - Add your Firebase config as environment variables in Netlify:
     - Go to Site settings > Environment variables
     - Add each Firebase config value as a separate variable
   - Or use Netlify's build-time environment variable injection

5. **Test the connection:**
   - Refresh the migration tool
   - Check the browser console for "Firebase initialized successfully"
   - The tool will fetch all stations from your Firebase database

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Repository

This project is hosted on GitHub: [https://github.com/GoldJack1/railstatisticsweb](https://github.com/GoldJack1/railstatisticsweb)

## File Structure

```
railstatisticsweb/
├── index.html                    # Main HTML file
├── styles.css                    # CSS styles
├── migration.js                  # JavaScript logic
├── firebase-config.template.js   # Firebase config template
├── firebase-config.js           # Firebase config (gitignored)
├── test-data.csv                # Sample CSV data for testing
├── package.json                 # Node.js package configuration
├── netlify.toml                 # Netlify deployment configuration
├── .gitignore                   # Git ignore rules
└── README.md                    # This file
```

## Customization

### Styling
- Modify `styles.css` to change colors, fonts, and layout
- CSS variables can be used for easy theme changes
- Responsive design breakpoints can be adjusted

### Matching Logic
- Adjust `fuzzyMatchThreshold` in `migration.js`
- Modify weight percentages in `calculateMatchConfidence()`
- Add new matching strategies as needed

### Export Formats
- Add new export options in the export section
- Modify data structure in export methods
- Add validation for export data

## Troubleshooting

### Common Issues

**CSV not parsing correctly**
- Check CSV format matches supported formats
- Ensure proper comma separation
- Verify no special characters in headers

**No stations matched**
- Lower the fuzzy match threshold
- Check if Firebase stations are loaded
- Verify station name formats

**QR code not working**
- Ensure QR code library is loaded
- Check data size (QR codes have size limits)
- Verify app supports QR code import

### Performance Issues

**Slow matching**
- Reduce the number of Firebase stations
- Optimize matching algorithms
- Add progress throttling

**Memory issues**
- Process stations in batches
- Clear unused data
- Optimize data structures

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify all files are properly loaded
3. Test with a small CSV file first
4. Check network connectivity for Firebase calls

## License

This tool is part of the Rail Statistics project. See the main project for licensing information.
