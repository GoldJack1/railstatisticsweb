# CSV Migration Tool - Supported Formats

The Migration Tool now supports **two different CSV formats** with automatic detection. The tool will automatically identify which format your CSV file is using and process it accordingly.

## Format 1: Original Format

**Example filename:** `stations.csv`, `stations_old.csv`

### Headers:
```
Station Name, Country, County, Operator, Visited, Visit Date, Favorite, Latitude, Longitude, 2024, 2023, 2022, ...
```

### Key Characteristics:
- Column name: `Station Name` (with space)
- Column name: `Favorite` (American spelling)
- Column name: `Visit Date` (no format specified)
- No `Type` column
- Numbers are typically without commas
- Visited values: typically `Yes` or `No`

### Example Row:
```csv
Station Name,Country,County,Operator,Visited,Visit Date,Favorite,Latitude,Longitude,2024,2023
Abbey Wood,England,London (City Of),Elizabeth Line,No,,No,51.49106056,0.121394025,0,7118664
```

---

## Format 2: New Format (with Type Column)

**Example filename:** `stations_20250917214403.csv`

### Headers:
```
Type, Station, Country, County, Operator, Visited, Visit Date DD/MM/YYYY, Favourite, Latitude, Longitude, 2024, 2023, 2022, ...
```

### Key Characteristics:
- **NEW:** `Type` column (e.g., "GBNationalRail")
- Column name: `Station` (not "Station Name")
- Column name: `Favourite` (British spelling)
- Column name: `Visit Date DD/MM/YYYY` (format specified in header)
- Numbers are quoted and contain commas (e.g., `"7,118,664"`)
- Visited values: `Yes` or `No`
- Missing data: `n/a` or `N/A`

### Example Row:
```csv
Type,Station,Country,County,Operator,Visited,Visit Date DD/MM/YYYY,Favourite,Latitude,Longitude,2024,2023
GBNationalRail,Abbey Wood,England,London (City Of),Elizabeth Line,No,,No,51.49106056,0.121394025,"7,118,664","2,638,456"
```

---

## How Format Detection Works

The migration tool automatically detects the format by examining the CSV headers:

1. **Format 2 Detection:** If the CSV contains both `Type` and `Station` columns
2. **Format 1 Detection:** If the CSV contains `Station Name` column
3. **Default:** If uncertain, defaults to Format 1

### Visual Feedback
When you upload a CSV file, the tool will display the detected format:
```
Detected CSV Format: Format 2 - New format with Type column (e.g., stations_20250917214403.csv)
```
or
```
Detected CSV Format: Format 1 - Original format with Station Name column
```

---

## Data Processing Differences

### Format 2 Specific Processing:
- **Type column:** Captured but not used in output (preserved for reference)
- **Number cleaning:** Automatically removes commas from quoted numbers
  - Input: `"7,118,664"` → Output: `7118664`
- **N/A handling:** Converts `n/a` and `N/A` to `0`
- **Date format:** Handles DD/MM/YYYY format in visit dates

### Common Processing (Both Formats):
- Station name matching with Firebase/local database
- Coordinate-based matching
- Fuzzy name matching with confidence scoring
- Yearly passenger data preservation
- Visit status and favorite status preservation

---

## Output Format

Regardless of which input format is used, the migration tool produces a **standardized output format**:

### Output Headers:
```
id, stnarea, stationname, CrsCode, tiploc, country, county, TOC, location, Is Visited, Visit Dates, Is Favorite, 2024, 2023, ...
```

### Key Features:
- Sequential IDs (0001, 0002, ...)
- CRS codes and TIPLOCs from database matching
- Location as JSON: `{"_latitude": 51.491, "_longitude": 0.121}`
- Standardized Yes/No values
- All yearly data from 2024 back to 1998

---

## Migration Statistics

The tool provides detailed statistics for both formats:
- **Total stations** processed
- **Matched stations** (found in database)
- **Unmatched stations** (not found in database)
- **Exact matches** (name matches exactly)
- **Fuzzy matches** (name similarity + location validation)
  - High confidence (80%+) - Green
  - Medium confidence (60-79%) - Amber
  - Low confidence (30-59%) - Red
- **Coordinate matches** (GPS location matching)
- **Visited stations** count
- **Favorite stations** count

---

## Tips for Best Results

### For Both Formats:
1. **Ensure accurate coordinates:** Better coordinates = better matching
2. **Include country/county data:** Helps validate fuzzy matches
3. **Use consistent station names:** Match official railway station names

### For Format 2 Specifically:
1. **Keep quoted numbers:** The parser handles them automatically
2. **Don't pre-clean n/a values:** They're handled automatically
3. **Visit dates:** Use DD/MM/YYYY format as specified in header

---

## Troubleshooting

### If format detection fails:
- Check that your CSV has the correct headers
- Ensure the first row contains column names
- Verify the file is properly formatted CSV

### If matching quality is poor:
- Switch to local data using the "Use Local Data" button
- Verify station names match official names
- Check coordinate accuracy

### If numbers aren't parsing correctly:
- Format 2: Keep commas in quotes (e.g., `"7,118,664"`)
- Format 1: Remove commas (e.g., `7118664`)
- Both: Avoid Excel's scientific notation

---

## Example Usage

1. **Upload your CSV file** (either format)
2. **Review detected format** (shown on screen)
3. **Click "Start Matching"** to begin processing
4. **Review results** including confidence rankings
5. **Manually adjust** any low-confidence matches using the search modal
6. **Download converted CSV** in standardized format

---

## Version History

- **v2.0** (2025-01-21): Added Format 2 support with Type column
- **v1.0** (Initial): Format 1 support with Station Name column

