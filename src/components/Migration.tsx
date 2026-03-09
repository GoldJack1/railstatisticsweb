import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStations } from '../hooks/useStations'
import { useStationCollection } from '../contexts/StationCollectionContext'
import { 
  matchStations, 
  generateMigrationResult, 
  downloadCSV,
  filterStationsByCountry,
  downloadRejectedStationsCSV,
  getRawCSV,
  suggestColumnMapping,
  parseCSVWithColumnMapping
} from '../services/migration'
import type { MigrationState, ColumnMapping } from '../types/migration'
import Button from './Button'
import './Migration.css'
import { formatStationLocationDisplay, isGreaterLondonCounty } from '../utils/formatStationLocation'

const Migration: React.FC = () => {
  const { stations: firebaseStations, loading: firebaseLoading } = useStations()
  const { collectionId } = useStationCollection()
  const [state, setState] = useState<MigrationState>({
    file: null,
    oldFormatData: [],
    rejectedStations: [],
    firebaseStations: [],
    matches: [],
    result: null,
    loading: false,
    error: null,
    step: 'upload',
    rawCsvContent: null,
    rawHeaders: [],
    rawPreviewRows: [],
    columnMapping: null,
    searchQuery: '',
    searchResults: [],
    searchByField: null,
    selectedMatchIndex: null,
    showSearchModal: false,
    showProgressModal: false,
    matchingProgress: 0,
    currentStationName: '',
    detectedFormat: null,
    correctionsCount: 0,
    duplicateGroupsSnapshot: null
  })

  const selectedMatch = state.selectedMatchIndex !== null ? state.matches[state.selectedMatchIndex] : null

  // Table search and display state
  const [tableState, setTableState] = useState({
    finalDataSearch: '',
    allDataSearch: '',
    showAllFinalData: false,
    showAllAllData: false
  })

  const [searchParams, setSearchParams] = useSearchParams()
  const searchMatchIndexParam = searchParams.get('matchIndex')
  const isSearchPageMode = searchParams.get('search') === '1' && searchMatchIndexParam !== null && searchMatchIndexParam !== ''

  const savedScrollPositionRef = useRef(0)
  const prevSearchPageModeRef = useRef(false)

  // Sync selectedMatchIndex from URL when on search page
  useEffect(() => {
    if (isSearchPageMode && searchMatchIndexParam !== null) {
      const idx = parseInt(searchMatchIndexParam, 10)
      if (!Number.isNaN(idx)) {
        setState(prev => (prev.selectedMatchIndex === idx ? prev : { ...prev, selectedMatchIndex: idx, showSearchModal: true }))
      }
    }
  }, [isSearchPageMode, searchMatchIndexParam])

  // Scroll to top when opening search page; restore scroll when leaving
  useEffect(() => {
    if (isSearchPageMode) {
      window.scrollTo(0, 0)
    } else if (prevSearchPageModeRef.current) {
      const saved = savedScrollPositionRef.current
      requestAnimationFrame(() => {
        window.scrollTo(0, saved)
      })
    }
    prevSearchPageModeRef.current = isSearchPageMode
  }, [isSearchPageMode])

  // Scroll to top when navigating to a new step
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [state.step])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setState(prev => ({ ...prev, error: 'Please select a CSV file' }))
      return
    }

    setState(prev => ({ ...prev, file, error: null }))

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string
        const { headers, rows } = getRawCSV(csvContent)
        const preview = rows.slice(0, 5)
        const suggested = suggestColumnMapping(headers)
        setState(prev => ({
          ...prev,
          rawCsvContent: csvContent,
          rawHeaders: headers,
          rawPreviewRows: preview,
          columnMapping: suggested,
          step: 'mapping',
          error: null
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: `Error reading CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
        }))
      }
    }
    reader.readAsText(file)
  }, [])

  const handleConfirmMapping = useCallback(() => {
    if (!state.rawCsvContent || !state.columnMapping) return
    try {
      const allStations = parseCSVWithColumnMapping(state.rawCsvContent, state.columnMapping)
      const { allowed, rejected } = filterStationsByCountry(allStations)
      setState(prev => ({
        ...prev,
        oldFormatData: allowed,
        rejectedStations: rejected,
        step: 'matching',
        error: null
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Error applying mapping: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
    }
  }, [state.rawCsvContent, state.columnMapping])

  const handleStartMatching = useCallback(async () => {
    if (state.oldFormatData.length === 0) return

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null,
      showProgressModal: true,
      matchingProgress: 0,
      currentStationName: ''
    }))

    try {
      const { matches, availableStations } = await matchStations(
        state.oldFormatData,
        (progress, currentStation) => {
          setState(prev => ({
            ...prev,
            matchingProgress: progress,
            currentStationName: currentStation
          }))
        },
        collectionId
      )
      const result = generateMigrationResult(matches, state.rejectedStations, availableStations)
      
      setState(prev => ({ 
        ...prev, 
        matches, 
        result, 
        step: 'review',
        loading: false,
        showProgressModal: false,
        correctionsCount: 0
      }))
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Error matching stations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        loading: false,
        showProgressModal: false
      }))
    }
  }, [state.oldFormatData, state.rejectedStations, collectionId])

  const handleDownload = useCallback(() => {
    if (!state.result) return
    downloadCSV(state.result.converted, 'migrated-stations.csv')
    setState(prev => ({ ...prev, step: 'complete' }))
  }, [state.result])

  const handleContinueToDuplicates = useCallback(() => {
    setState(prev => {
      const snapshot = prev.result?.duplicateGroups?.length
        ? [...(prev.result.duplicateGroups)]
        : null
      return { ...prev, step: 'duplicates', duplicateGroupsSnapshot: snapshot }
    })
  }, [])

  const handleBackToReview = useCallback(() => {
    setState(prev => ({ ...prev, step: 'review', duplicateGroupsSnapshot: null }))
  }, [])

  const handleContinueToSummary = useCallback(() => {
    const duplicateIds = state.result?.stats?.duplicateIds ?? 0
    if (duplicateIds > 0 && !window.confirm(`You still have ${duplicateIds} duplicate ID(s). Continue to summary anyway?`)) {
      return
    }
    setState(prev => ({ ...prev, step: 'complete', duplicateGroupsSnapshot: null }))
  }, [state.result?.stats?.duplicateIds])

  const handleDownloadRejected = useCallback(() => {
    if (!state.result || !state.result.rejected || state.result.rejected.length === 0) return
    downloadRejectedStationsCSV(state.result.rejected, 'rejected-stations.csv')
  }, [state.result])



  const handleReset = useCallback(() => {
    setState({
      file: null,
      oldFormatData: [],
      rejectedStations: [],
      firebaseStations: [],
      matches: [],
      result: null,
      loading: false,
      error: null,
      step: 'upload',
      rawCsvContent: null,
      rawHeaders: [],
      rawPreviewRows: [],
      columnMapping: null,
      searchQuery: '',
      searchResults: [],
      searchByField: null,
      selectedMatchIndex: null,
      showSearchModal: false,
      showProgressModal: false,
      matchingProgress: 0,
      currentStationName: '',
      detectedFormat: null,
      correctionsCount: 0,
      duplicateGroupsSnapshot: null
    })
  }, [])

  const setColumnMappingField = useCallback((field: keyof ColumnMapping, value: string) => {
    setState(prev => ({
      ...prev,
      columnMapping: prev.columnMapping
        ? { ...prev.columnMapping, [field]: value }
        : null
    }))
  }, [])

  // Normalize text for search: lowercase, strip apostrophes so "st john's" and "st johns" match the same, collapse spaces/parens
  const normalizeSearchText = useCallback((s: string) => {
    if (!s || typeof s !== 'string') return ''
    return s
      .toLowerCase()
      .replace(/[\u2018\u2019\u201A\u201B\u2032']/g, '')
      .replace(/[()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [])

  // Search by name, tiploc, CRS, county, country, borough. Uses word-based matching so "Queen Park London" finds "Queen's Park (London)".
  const handleSearchStations = useCallback((query: string) => {
    if (!query.trim()) {
      setState(prev => ({ ...prev, searchQuery: query, searchResults: [] }))
      return
    }

    const normalizedQuery = normalizeSearchText(query)
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean)

    const results = firebaseStations.filter(station => {
      const name = station.stationName || ''
      const crs = station.crsCode || ''
      const tiploc = station.tiploc || ''
      const country = station.country || ''
      const county = station.county || ''
      const borough = station.londonBorough || ''
      const searchable = normalizeSearchText([name, crs, tiploc, country, county, borough].join(' '))

      if (!searchable) return false
      if (normalizedQuery.length <= 1) {
        return searchable.includes(normalizedQuery)
      }
      return queryWords.every(word => searchable.includes(word))
    })

    setState(prev => ({
      ...prev,
      searchQuery: query,
      searchResults: results.slice(0, 15),
      searchByField: null
    }))
  }, [firebaseStations, normalizeSearchText])

  // Search by a single field only (does not fill the search box). Used by "Search by" buttons.
  type SearchByField = 'name' | 'crs' | 'tiploc' | 'county' | 'country'
  const handleSearchByField = useCallback((field: SearchByField, value: string) => {
    if (!value?.trim()) {
      setState(prev => ({ ...prev, searchByField: null, searchResults: [] }))
      return
    }
    const term = value.trim().toLowerCase()

    const results = firebaseStations.filter(station => {
      switch (field) {
        case 'name':
          return normalizeSearchText(station.stationName || '').includes(normalizeSearchText(value))
        case 'crs':
          return (station.crsCode || '').toLowerCase().includes(term)
        case 'tiploc':
          return (station.tiploc || '').toLowerCase().includes(term)
        case 'county':
          return normalizeSearchText(station.county || '').includes(normalizeSearchText(value))
        case 'country':
          return normalizeSearchText(station.country || '').includes(normalizeSearchText(value))
        default:
          return false
      }
    })

    setState(prev => ({
      ...prev,
      searchByField: field,
      searchResults: results.slice(0, 15)
    }))
  }, [firebaseStations, normalizeSearchText])

  const handleSelectStation = useCallback((matchIndex: number, selectedStation: any) => {
    setState(prev => {
      const newMatches = [...prev.matches]
      const wasNoMatch = newMatches[matchIndex].matchType === 'none'
      newMatches[matchIndex] = {
        ...newMatches[matchIndex],
        firebaseStation: selectedStation,
        matchType: 'manual' as any,
        confidence: 1.0,
        suggestedId: selectedStation.id || '',
        suggestedCrsCode: selectedStation.crsCode || '',
        suggestedTiploc: selectedStation.tiploc || '',
        ...(wasNoMatch ? { correctedFromNoMatch: true } : {})
      }
      // Use the same availableStations as the current result (same collection), not current hook list
      const availableStations = prev.result?.availableStations ?? firebaseStations
      const newResult = generateMigrationResult(newMatches, prev.rejectedStations, availableStations)
      
      return {
        ...prev,
        matches: newMatches,
        result: newResult,
        showSearchModal: false,
        selectedMatchIndex: null,
        searchQuery: '',
        searchResults: [],
        correctionsCount: (prev.correctionsCount ?? 0) + 1
      }
    })
  }, [firebaseStations])

  const handleOpenSearchModal = useCallback((matchIndex: number) => {
    savedScrollPositionRef.current = window.scrollY
    setSearchParams({ search: '1', matchIndex: String(matchIndex) })
    setState(prev => ({
      ...prev,
      selectedMatchIndex: matchIndex,
      showSearchModal: true,
      searchQuery: '',
      searchResults: [],
      searchByField: null
    }))
  }, [setSearchParams])

  const handleCloseSearchModal = useCallback(() => {
    if (isSearchPageMode) {
      setSearchParams({})
    }
    setState(prev => ({
      ...prev,
      showSearchModal: false,
      selectedMatchIndex: null,
      searchQuery: '',
      searchResults: [],
      searchByField: null
    }))
  }, [isSearchPageMode, setSearchParams])

  const handleClearSearchByField = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchByField: null,
      searchResults: []
    }))
  }, [])

  // Table search and display functions
  const filterTableData = useCallback((data: any[], searchQuery: string) => {
    if (!searchQuery.trim()) return data
    
    const query = searchQuery.toLowerCase()
    return data.filter(station => 
      station.stationname?.toLowerCase().includes(query) ||
      station.CrsCode?.toLowerCase().includes(query) ||
      station.country?.toLowerCase().includes(query) ||
      station.county?.toLowerCase().includes(query) ||
      station.TOC?.toLowerCase().includes(query) ||
      station.id?.toLowerCase().includes(query)
    )
  }, [])

  const getDisplayData = useCallback((data: any[], searchQuery: string, showAll: boolean) => {
    const filtered = filterTableData(data, searchQuery)
    return showAll ? filtered : filtered.slice(0, 10)
  }, [filterTableData])

  const handleTableSearch = useCallback((tableType: 'finalData' | 'allData', query: string) => {
    setTableState(prev => ({
      ...prev,
      [`${tableType}Search`]: query
    }))
  }, [])

  const handleShowAllData = useCallback((tableType: 'finalData' | 'allData') => {
    setTableState(prev => ({
      ...prev,
      [`showAll${tableType.charAt(0).toUpperCase() + tableType.slice(1)}`]: !prev[`showAll${tableType.charAt(0).toUpperCase() + tableType.slice(1)}` as keyof typeof prev]
    }))
  }, [])

  // Future enhancement: Allow manual editing of matches
  // const updateMatch = useCallback((index: number, updates: Partial<StationMatch>) => {
  //   setState(prev => {
  //     const newMatches = [...prev.matches]
  //     newMatches[index] = { ...newMatches[index], ...updates }
  //     const newResult = generateMigrationResult(newMatches)
  //     return { ...prev, matches: newMatches, result: newResult }
  //   })
  // }, [])

  // Debug logging
  console.log('Migration component render - firebaseLoading:', firebaseLoading)

  if (firebaseLoading) {
    console.log('Showing loading screen')
    return (
      <div className="migration-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading data from Cloud Database...</p>
        </div>
      </div>
    )
  }

  // Full-page station search (URL has ?search=1&matchIndex=N) – used on all screen sizes
  if (isSearchPageMode && state.selectedMatchIndex !== null) {
    return (
      <div className="search-page-container">
        <header className="search-page-header">
          <button
            type="button"
            className="search-page-back"
            onClick={handleCloseSearchModal}
            aria-label="Back to migration"
          >
            ← Back to migration
          </button>
          <h1 className="search-page-title">Search for Station</h1>
          <p className="search-page-subtitle">Match this row from your file to a station in the database</p>
        </header>
        <main className="search-page-content">
          <div className="search-modal-controls">
            <div className="current-station">
              <h4>From your file</h4>
              <p className="current-station-name">{selectedMatch?.oldStation.stationName}</p>
              <p className="current-station-location">
                {formatStationLocationDisplay({
                  county: selectedMatch?.oldStation.county,
                  country: selectedMatch?.oldStation.country
                })}
              </p>
            </div>
            <section className="quick-fill-section" aria-labelledby="quick-fill-heading">
              <h3 id="quick-fill-heading" className="quick-fill-heading">Quick fill</h3>
              <p className="quick-fill-description">
                Fill the search box with data from your file, then search the database.
              </p>
              <div className="quick-search-buttons" aria-label="Quick fill options">
                <button type="button" className="quick-search-btn" onClick={() => handleSearchStations(selectedMatch?.oldStation.stationName || '')}>+ Station name</button>
                {selectedMatch?.oldStation.county && <button type="button" className="quick-search-btn" onClick={() => handleSearchStations(`${selectedMatch.oldStation.stationName} ${selectedMatch.oldStation.county}`)}>+ County</button>}
                {selectedMatch?.oldStation.country && <button type="button" className="quick-search-btn" onClick={() => handleSearchStations(`${selectedMatch.oldStation.stationName} ${selectedMatch.oldStation.country}`)}>+ Country</button>}
                {selectedMatch?.suggestedCrsCode && <button type="button" className="quick-search-btn" onClick={() => handleSearchStations(selectedMatch.suggestedCrsCode)}>CRS</button>}
                {selectedMatch?.suggestedTiploc && <button type="button" className="quick-search-btn" onClick={() => handleSearchStations(selectedMatch.suggestedTiploc)}>TIPLOC</button>}
              </div>
            </section>
            <div className="search-input">
              <label htmlFor="migration-search-field-page" className="search-field-label">Search</label>
              <div className="search-input-row">
                <input
                  id="migration-search-field-page"
                  type="text"
                  placeholder="Name, CRS, TIPLOC, county, country or borough..."
                  value={state.searchQuery}
                  onChange={(e) => handleSearchStations(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchStations(state.searchQuery) } }}
                  className="search-field"
                  autoFocus
                />
                <button type="button" className="search-run-button" onClick={() => handleSearchStations(state.searchQuery)}>Search</button>
              </div>
              <p className="search-by-label">Search by field only</p>
              <div className="search-by-row">
                <div className="search-by-buttons" aria-label="Search by field only">
                  <button type="button" className={`search-by-btn ${state.searchByField === 'name' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('name', selectedMatch?.oldStation.stationName || '')}>Name</button>
                  <button type="button" className={`search-by-btn ${state.searchByField === 'crs' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('crs', state.searchQuery.trim().slice(0, 3))} title="Search by CRS code (3 characters)">CRS</button>
                  <button type="button" className={`search-by-btn ${state.searchByField === 'tiploc' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('tiploc', state.searchQuery.trim())} title="Search by TIPLOC">TIPLOC</button>
                  {selectedMatch?.oldStation.county && <button type="button" className={`search-by-btn ${state.searchByField === 'county' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('county', selectedMatch.oldStation.county)}>County</button>}
                  {selectedMatch?.oldStation.country && <button type="button" className={`search-by-btn ${state.searchByField === 'country' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('country', selectedMatch.oldStation.country)}>Country</button>}
                </div>
                {state.searchByField !== null && <button type="button" className="search-by-clear" onClick={handleClearSearchByField} aria-label="Remove search-by filter" title="Remove filter">×</button>}
              </div>
            </div>
          </div>
          <div className="search-modal-results">
            <h4 className="search-results-heading">Results</h4>
            <div className="search-results">
              {state.searchResults.length > 0 ? (
                <div className="results-list">
                  {state.searchResults.map((station, index) => (
                    <div
                      key={index}
                      className="search-result-item"
                      onClick={() => {
                        handleSelectStation(state.selectedMatchIndex!, station)
                        if (isSearchPageMode) setSearchParams({})
                      }}
                    >
                      <div className="result-station-name">{station.stationName}</div>
                      <div className="result-details">
                        <span className="result-crs">{station.crsCode}</span>
                        <span className="result-tiploc">{station.tiploc}</span>
                        <span className="result-location">
                          {formatStationLocationDisplay({ county: station.county, country: station.country, londonBorough: station.londonBorough })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : state.searchQuery || state.searchByField !== null ? (
                <div className="no-results">No stations found. Try another search or filter.</div>
              ) : (
                <div className="search-hint">Use quick fill, type in the search box, or choose a search-by field to see results.</div>
              )}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="migration-container">
      <div className="migration-header">
        <div className="header-top">
          <h1>CSV Migration Tool</h1>
        </div>
        <p>Convert old format CSV files to the new format with Firebase station matching</p>
      </div>

      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}

      {/* Step 1: File Upload */}
      {state.step === 'upload' && (
        <div className="migration-step">
          <h2>Step 1: Upload Old Format CSV</h2>
          <p className="step-description">Choose a CSV file from your device to convert to the new format.</p>
          <div className="upload-area">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="file-input"
              id="csv-upload"
              style={{ display: 'none' }}
            />
            <Button 
              variant="wide" 
              width="hug"
              onClick={() => document.getElementById('csv-upload')?.click()}
            >
              {state.file ? state.file.name : 'Choose CSV file'}
            </Button>
            {state.file && (
              <div className="file-info">
                <p>File selected: {state.file.name}</p>
                <p>Size: {(state.file.size / 1024).toFixed(1)} KB</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Column mapping */}
      {state.step === 'mapping' && state.columnMapping && (
        <div className="migration-step mapping-step">
          <h2>Step 2: Map your columns</h2>
          <p className="mapping-intro">
            Match each required field to a column from your CSV. First 5 rows are shown below.
          </p>
          <div className="mapping-grid">
            <div className="mapping-fields">
              <label className="mapping-field">
                <span className="mapping-label">Station Name</span>
                <select
                  value={state.columnMapping.stationName}
                  onChange={(e) => setColumnMappingField('stationName', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Country</span>
                <select
                  value={state.columnMapping.country}
                  onChange={(e) => setColumnMappingField('country', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">County</span>
                <select
                  value={state.columnMapping.county}
                  onChange={(e) => setColumnMappingField('county', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Operator / TOC</span>
                <select
                  value={state.columnMapping.operator}
                  onChange={(e) => setColumnMappingField('operator', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Visited</span>
                <select
                  value={state.columnMapping.visited}
                  onChange={(e) => setColumnMappingField('visited', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Visit Date</span>
                <select
                  value={state.columnMapping.visitDate}
                  onChange={(e) => setColumnMappingField('visitDate', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Favorite</span>
                <select
                  value={state.columnMapping.favorite}
                  onChange={(e) => setColumnMappingField('favorite', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Latitude</span>
                <select
                  value={state.columnMapping.latitude}
                  onChange={(e) => setColumnMappingField('latitude', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Longitude</span>
                <select
                  value={state.columnMapping.longitude}
                  onChange={(e) => setColumnMappingField('longitude', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="mapping-field">
                <span className="mapping-label">Location (JSON, optional)</span>
                <select
                  value={state.columnMapping.location ?? ''}
                  onChange={(e) => setColumnMappingField('location', e.target.value)}
                >
                  <option value="">(Don't map)</option>
                  {state.rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mapping-preview">
              <p className="preview-title">Preview (first 5 rows)</p>
              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      {state.rawHeaders.map((h) => (
                        <th key={h} title={h}>{h.length > 12 ? h.slice(0, 11) + '…' : h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.rawPreviewRows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} title={cell}>{String(cell).length > 15 ? String(cell).slice(0, 14) + '…' : cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mapping-actions">
            <Button onClick={handleConfirmMapping} variant="wide" width="hug">
              Continue to matching
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Matching */}
      {state.step === 'matching' && (
        <div className="migration-step">
          <h2>Step 3: Station Matching</h2>
          <p className="step-description">Match your stations to the cloud database. This may take a moment.</p>
          <div className="matching-info">
            <p>Found {state.oldFormatData.length} Stations | In Cloud Database: {firebaseStations.length}</p>
            <div>
              {state.rejectedStations.length > 0 && (
                <div className="rejected-chip">
                  {state.rejectedStations.length} Stations Rejected (Not in England, Scotland or Wales)
                </div>
              )}
            </div>
            {state.file && (
              <p className="uploaded-file-info">
                <strong>Uploaded File:</strong> {state.file.name}
              </p>
            )}
            <Button 
              onClick={handleStartMatching}
              disabled={state.loading}
              variant="wide"
              width="hug"
            >
              {state.loading ? 'Matching...' : 'Start Matching'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review Results */}
      {state.step === 'review' && state.result && (
        <div className="migration-step">
          <h2>Step 3: Review Results</h2>
          <p className="step-description">Check unmatched and fuzzy matches, then fix any issues with Correct before continuing.</p>
          <div className="migration-stats">
            <div className="stat-card">
              <h3>Total Stations</h3>
              <span className="stat-number">{state.result.stats.total}</span>
            </div>
            <div className="stat-card">
              <h3>Matched</h3>
              <span className="stat-number">{state.result.stats.matched}</span>
            </div>
            <div className="stat-card">
              <h3>Unmatched</h3>
              <span className="stat-number">{state.result.stats.unmatched}</span>
            </div>
            <div className="stat-card visited">
              <h3>Visited</h3>
              <span className="stat-number">{state.result.stats.visited}</span>
            </div>
            <div className="stat-card favorites">
              <h3>Favorites</h3>
              <span className="stat-number">{state.result.stats.favorites}</span>
            </div>
            {state.result.stats.rejected > 0 && (
              <div className="stat-card rejected">
                <h3>Rejected</h3>
                <span className="stat-number">{state.result.stats.rejected}</span>
              </div>
            )}
            {state.result.stats.duplicateIds > 0 && (
              <div className="stat-card duplicates">
                <h3>Duplicate IDs</h3>
                <span className="stat-number">{state.result.stats.duplicateIds}</span>
              </div>
            )}
          </div>

          <div className="match-breakdown">
            <h3>Match Types</h3>
            <ul>
              <li>Exact matches: {state.result.stats.exactMatches}</li>
              <li>Fuzzy matches: {state.result.stats.fuzzyMatches}</li>
              <li>No matches: {state.result.stats.unmatched}</li>
              {state.result.stats.duplicateIds > 0 && (
                <li>Duplicate IDs: {state.result.stats.duplicateIds}</li>
              )}
            </ul>
          </div>

          {/* Fuzzy Match Confidence Rankings */}
          {state.result.stats.fuzzyMatches > 0 && (
            <div className="fuzzy-match-ranks">
              <h3>Fuzzy Match Confidence Rankings</h3>
              <p className="rank-legend">
                <span className="rank-legend-from">From your file</span>
                <span className="rank-legend-arrow">→</span>
                <span className="rank-legend-to">Matched in database</span>
              </p>
              <div className="confidence-ranks">
                {/* Amber - Medium Confidence (60-79%) */}
                {(() => {
                  const amberMatches = state.result.matches.filter(m => 
                    m.matchType === 'fuzzy' && m.confidence >= 0.6 && m.confidence < 0.8
                  )
                  return amberMatches.length > 0 && (
                    <div className="confidence-rank amber">
                      <div className="rank-header">
                        <span className="rank-indicator amber"></span>
                        <h4>Medium Confidence (60-79%)</h4>
                        <span className="rank-count">{amberMatches.length}</span>
                      </div>
                      <div className="rank-matches">
                        {amberMatches.slice(0, 5).map((match, index) => {
                          const originalIndex = state.result?.matches.findIndex(m => m === match) ?? -1
                          const fb = match.firebaseStation
                          return (
                            <div key={index} className="rank-match">
                              <span className="match-confidence">{(match.confidence * 100).toFixed(1)}%</span>
                              <div className="station-details rank-from">
                                <span className="rank-label">From your file</span>
                                <div className="match-name-row">
                                  <span className="match-name">{match.oldStation.stationName}</span>
                                </div>
                                <div className="match-location">
                                  <small>
                                    {formatStationLocationDisplay({
                                      county: match.oldStation.county,
                                      country: match.oldStation.country
                                    })}
                                  </small>
                                </div>
                              </div>
                              <div className="match-arrow">→</div>
                              <div className="station-details rank-to">
                                <span className="rank-label">Matched in database</span>
                                {fb ? (
                                  <>
                                    <div className="match-name-row">
                                      {(fb.crsCode || fb.CrsCode) && <span className="match-crs">{fb.crsCode || fb.CrsCode}</span>}
                                      <span className="match-name">{fb.stationName || fb.stationname}</span>
                                    </div>
                                    <div className="match-location">
                                      <small>
                                        {formatStationLocationDisplay({
                                          county: fb.county,
                                          country: fb.country,
                                          londonBorough: fb.londonBorough
                                        })}
                                      </small>
                                    </div>
                                    {fb.londonBorough && !isGreaterLondonCounty(fb.county) && (
                                      <span className="match-borough">{fb.londonBorough}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="match-empty">—</span>
                                )}
                              </div>
                              <div className="rank-match-button-wrapper">
                                <Button 
                                  onClick={() => handleOpenSearchModal(originalIndex)}
                                  variant="wide"
                                  width="hug"
                                  className="rank-match-button"
                                  ariaLabel={match.firebaseStation ? 'Change matched station' : 'Search for a different station'}
                                >
                                  {match.firebaseStation ? 'Re-correct' : 'Correct'}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                        {amberMatches.length > 5 && (
                          <div className="more-matches">... and {amberMatches.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Red - Low Confidence (30-59%) */}
                {(() => {
                  const redMatches = state.result.matches.filter(m => 
                    m.matchType === 'fuzzy' && m.confidence >= 0.3 && m.confidence < 0.6
                  )
                  return redMatches.length > 0 && (
                    <div className="confidence-rank red">
                      <div className="rank-header">
                        <span className="rank-indicator red"></span>
                        <h4>Low Confidence (30-59%)</h4>
                        <span className="rank-count">{redMatches.length}</span>
                      </div>
                      <div className="rank-matches">
                        {redMatches.slice(0, 5).map((match, index) => {
                          const originalIndex = state.result?.matches.findIndex(m => m === match) ?? -1
                          const fb = match.firebaseStation
                          return (
                            <div key={index} className="rank-match">
                              <span className="match-confidence">{(match.confidence * 100).toFixed(1)}%</span>
                              <div className="station-details rank-from">
                                <span className="rank-label">From your file</span>
                                <div className="match-name-row">
                                  <span className="match-name">{match.oldStation.stationName}</span>
                                </div>
                                <div className="match-location">
                                  <small>
                                    {formatStationLocationDisplay({
                                      county: match.oldStation.county,
                                      country: match.oldStation.country
                                    })}
                                  </small>
                                </div>
                              </div>
                              <div className="match-arrow">→</div>
                              <div className="station-details rank-to">
                                <span className="rank-label">Matched in database</span>
                                {fb ? (
                                  <>
                                    <div className="match-name-row">
                                      {(fb.crsCode || fb.CrsCode) && <span className="match-crs">{fb.crsCode || fb.CrsCode}</span>}
                                      <span className="match-name">{fb.stationName || fb.stationname}</span>
                                    </div>
                                    <div className="match-location">
                                      <small>
                                        {formatStationLocationDisplay({
                                          county: fb.county,
                                          country: fb.country,
                                          londonBorough: fb.londonBorough
                                        })}
                                      </small>
                                    </div>
                                    {fb.londonBorough && !isGreaterLondonCounty(fb.county) && (
                                      <span className="match-borough">{fb.londonBorough}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="match-empty">—</span>
                                )}
                              </div>
                              <div className="rank-match-button-wrapper">
                                <Button 
                                  onClick={() => handleOpenSearchModal(originalIndex)}
                                  variant="wide"
                                  width="hug"
                                  className="rank-match-button"
                                  ariaLabel={match.firebaseStation ? 'Change matched station' : 'Search for a different station'}
                                >
                                  {match.firebaseStation ? 'Re-correct' : 'Correct'}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                        {redMatches.length > 5 && (
                          <div className="more-matches">... and {redMatches.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* No automatic match – show unmatched and user-corrected so they can re-correct if needed */}
          {(() => {
            const noMatchEntries = state.result.matches
              .map((m, i) => ({ match: m, index: i }))
              .filter(({ match }) => match.matchType === 'none' || match.correctedFromNoMatch === true)
            if (noMatchEntries.length === 0) return null
            return (
              <div className="no-matches-section rejected-stations-section">
                <div>
                  <h3>⚠️ No automatic match ({noMatchEntries.length})</h3>
                  <p className="section-description">
                    These stations had no automatic match. Use <strong>Correct</strong> to search and pick a station (or change your choice). Matched rows stay here so you can fix any errors.
                  </p>
                  <p className="rank-legend">
                    <span className="rank-legend-from">From your file</span>
                    <span className="rank-legend-arrow">→</span>
                    <span className="rank-legend-to">Matched in database</span>
                  </p>
                </div>
                <div className="rank-matches no-match-cards">
                  {noMatchEntries.map(({ match, index }) => {
                    const fb = match.firebaseStation
                    const isCorrected = match.matchType === 'manual'
                    return (
                      <div key={index} className={`rank-match ${isCorrected ? 'rank-match-corrected' : ''}`}>
                        <div className="station-details rank-from">
                          <span className="rank-label">From your file</span>
                          <div className="match-name-row">
                            <span className="match-name">{match.oldStation.stationName}</span>
                          </div>
                          <div className="match-location">
                            <small>
                              {formatStationLocationDisplay({
                                county: match.oldStation.county,
                                country: match.oldStation.country
                              })}
                            </small>
                          </div>
                        </div>
                        <div className="match-arrow">→</div>
                        <div className="station-details rank-to">
                          <span className="rank-label">Matched in database</span>
                          {fb ? (
                            <>
                              <div className="match-name-row">
                                {(fb.crsCode || fb.CrsCode) && <span className="match-crs">{fb.crsCode || fb.CrsCode}</span>}
                                <span className="match-name">{fb.stationName || fb.stationname}</span>
                              </div>
                              <div className="match-location">
                                <small>
                                  {formatStationLocationDisplay({
                                    county: fb.county,
                                    country: fb.country,
                                    londonBorough: fb.londonBorough
                                  })}
                                </small>
                              </div>
                              {fb.londonBorough && !isGreaterLondonCounty(fb.county) && (
                                <span className="match-borough">{fb.londonBorough}</span>
                              )}
                            </>
                          ) : (
                            <span className="match-empty">—</span>
                          )}
                        </div>
                        <div className="rank-match-button-wrapper">
                          <Button
                            onClick={() => handleOpenSearchModal(index)}
                            variant="wide"
                            width="hug"
                            className="rank-match-button"
                            ariaLabel={match.firebaseStation ? `Change matched station for ${match.oldStation.stationName}` : `Search for a station to match ${match.oldStation.stationName}`}
                          >
                            {match.firebaseStation ? 'Re-correct' : 'Correct'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Rejected Stations Section */}
          {state.result.rejected && state.result.rejected.length > 0 && (
            <div className="rejected-stations-section">
              <div>
                <h3>❌ Rejected Stations ({state.result.rejected.length})</h3>
                <p className="section-description">
                  These stations were rejected because they are not located in England, Scotland, or Wales.
                </p>
              </div>
              
              <div className="rejected-stations-list">
                <table className="rejected-table">
                  <thead>
                    <tr>
                      <th>Station Name</th>
                      <th>Country</th>
                      <th>County</th>
                      <th>Operator</th>
                      <th>Visited</th>
                      <th>Favorite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.result.rejected.map((station, index) => (
                      <tr key={index}>
                        <td className="station-name-cell">{station.stationName}</td>
                        <td className="country-cell">{station.country}</td>
                        <td className="county-cell">{station.county || '-'}</td>
                        <td className="operator-cell">{station.operator || '-'}</td>
                        <td className="visited-cell">{station.visited}</td>
                        <td className="favorite-cell">{station.favorite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="section-button-container">
                <Button 
                  onClick={handleDownloadRejected}
                  variant="wide"
                  width="hug"
                  className="section-button"
                  ariaLabel="Download rejected stations as CSV"
                >
                  Export Rejected
                </Button>
              </div>
            </div>
          )}

          <div className="action-buttons">
            <Button onClick={handleContinueToDuplicates} variant="wide" width="hug" className="action-button">
              Next: Check duplicates
            </Button>
            <Button onClick={handleReset} variant="wide" width="hug" className="action-button">
              Start Over
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Duplicates */}
      {state.step === 'duplicates' && state.result && (
        <div className="migration-step">
          <h2>Step 4: Check duplicate IDs</h2>
          <p className="step-description">
            Fix any rows that share the same output ID (e.g. same station name in different places). Use <strong>Correct</strong> to assign the right station, then continue to summary.
          </p>
          <div className="migration-stats">
            <div className="stat-card">
              <h3>Total Stations</h3>
              <span className="stat-number">{state.result.stats.total}</span>
            </div>
            <div className="stat-card">
              <h3>Matched</h3>
              <span className="stat-number">{state.result.stats.matched}</span>
            </div>
            <div className="stat-card">
              <h3>Unmatched</h3>
              <span className="stat-number">{state.result.stats.unmatched}</span>
            </div>
            <div className="stat-card visited">
              <h3>Visited</h3>
              <span className="stat-number">{state.result.stats.visited}</span>
            </div>
            <div className="stat-card favorites">
              <h3>Favorites</h3>
              <span className="stat-number">{state.result.stats.favorites}</span>
            </div>
            {state.result.stats.rejected > 0 && (
              <div className="stat-card rejected">
                <h3>Rejected</h3>
                <span className="stat-number">{state.result.stats.rejected}</span>
              </div>
            )}
            {state.result.stats.duplicateIds > 0 && (
              <div className="stat-card duplicates">
                <h3>Duplicate IDs</h3>
                <span className="stat-number">{state.result.stats.duplicateIds}</span>
              </div>
            )}
          </div>
          <div className="match-breakdown">
            <h3>Match Types</h3>
            <ul>
              <li>Exact matches: {state.result.stats.exactMatches}</li>
              <li>Fuzzy matches: {state.result.stats.fuzzyMatches}</li>
              <li>No matches: {state.result.stats.unmatched}</li>
              {state.result.stats.duplicateIds > 0 && (
                <li>Duplicate IDs: {state.result.stats.duplicateIds}</li>
              )}
            </ul>
          </div>
          {(() => {
            const duplicateGroupsToShow = (state.step === 'duplicates' && state.duplicateGroupsSnapshot && state.duplicateGroupsSnapshot.length > 0)
              ? state.duplicateGroupsSnapshot
              : (state.result?.duplicateGroups ?? [])
            const hasDuplicateSections = duplicateGroupsToShow.length > 0 && state.result?.outputIds
            return hasDuplicateSections ? (
            <section className="duplicates-step-section" aria-labelledby="duplicate-ids-heading">
              <h3 id="duplicate-ids-heading" className="duplicates-step-section-title">Duplicate IDs</h3>
              <p className="duplicates-step-section-desc">Rows that share the same output ID. Use <strong>Correct</strong> to assign the right station for each row.</p>
              <p className="rank-legend">
                <span className="rank-legend-from">From your file</span>
                <span className="rank-legend-arrow">→</span>
                <span className="rank-legend-to">Matched in database</span>
              </p>
              {(() => {
                const outputIds = state.result!.outputIds
                const groupsWithRanges = duplicateGroupsToShow.map((group) => {
                  const idNum = parseInt(group.id, 10)
                  const isNumeric = !isNaN(idNum)
                  const rangeStart = isNumeric ? idNum - 2 : 0
                  const rangeEnd = isNumeric ? idNum + 2 : 0
                  const pad = (n: number) => (group.id.length >= 4 ? String(n).padStart(4, '0') : String(n))
                  const expectedIds: string[] = isNumeric
                    ? Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => pad(rangeStart + i))
                    : [group.id]
                  const idRangeSet = new Set(expectedIds)
                  const indicesInRange = outputIds
                    .map((id, k) => (idRangeSet.has(id) ? k : -1))
                    .filter((k) => k >= 0)
                  const rangeLabel = expectedIds.length ? `${expectedIds[0]}–${expectedIds[expectedIds.length - 1]}` : group.id
                  return { group, indicesInRange, rangeLabel, expectedIds, idRangeSet }
                })
                const firstOpenIndex = groupsWithRanges.findIndex((g) => g.indicesInRange.length > 0)
                return groupsWithRanges.map(({ group, indicesInRange, rangeLabel, expectedIds }, gIdx) => {
                  const isResolved = indicesInRange.length === 0
                  const isOpen = !isResolved && gIdx === firstOpenIndex
                  return (
                  <details
                    key={gIdx}
                    className={`duplicate-group-details duplicate-group-block${isResolved ? ' duplicate-group-resolved' : ''}`}
                    open={isOpen}
                  >
                    <summary className="duplicate-group-summary">
                      {isResolved && (
                        <span className="duplicate-group-resolved-check" aria-hidden="true">✓</span>
                      )}
                      <span className="duplicate-group-title">Duplicate ID: {group.id} ({indicesInRange.length} rows)</span>
                      <span className="duplicate-range-label"> — IDs {rangeLabel}</span>
                    </summary>
                    <div className="rank-matches no-match-cards">
                      {indicesInRange.length === 0 ? (
                        <p className="duplicate-group-all-resolved">All rows in this group have been assigned new IDs.</p>
                      ) : indicesInRange.map((matchIndex) => {
                        const match = state.result!.matches[matchIndex]
                        const fb = match.firebaseStation
                        const isCorrected = match.matchType === 'manual'
                        return (
                          <div key={matchIndex} className={`rank-match ${isCorrected ? 'rank-match-corrected' : ''}`}>
                            <div className="station-details rank-from">
                              <span className="rank-label">From your file</span>
                              <div className="match-name-row">
                                <span className="match-name">{match.oldStation.stationName}</span>
                              </div>
                              <div className="match-location">
                                <small>
                                  {formatStationLocationDisplay({
                                    county: match.oldStation.county,
                                    country: match.oldStation.country
                                  })}
                                </small>
                              </div>
                            </div>
                            <div className="match-arrow">→</div>
                            <div className="station-details rank-to">
                              <span className="rank-label">Matched in database</span>
                              {fb ? (
                                <>
                                  <div className="match-name-row">
                                    {(fb.crsCode || fb.CrsCode) && <span className="match-crs">{fb.crsCode || fb.CrsCode}</span>}
                                    <span className="match-name">{fb.stationName || fb.stationname}</span>
                                  </div>
                                  <div className="match-location">
                                    <small>
                                      {formatStationLocationDisplay({
                                        county: fb.county,
                                        country: fb.country,
                                        londonBorough: fb.londonBorough
                                      })}
                                    </small>
                                  </div>
                                  {fb.londonBorough && !isGreaterLondonCounty(fb.county) && (
                                    <span className="match-borough">{fb.londonBorough}</span>
                                  )}
                                </>
                              ) : (
                                <span className="match-empty">—</span>
                              )}
                            </div>
                            <div className="rank-match-button-wrapper">
                              <Button
                                onClick={() => handleOpenSearchModal(matchIndex)}
                                variant="wide"
                                width="hug"
                                className="rank-match-button"
                                ariaLabel={match.firebaseStation ? `Change matched station for ${match.oldStation.stationName}` : `Change station for ${match.oldStation.stationName}`}
                              >
                                {match.firebaseStation ? 'Re-correct' : 'Correct'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {indicesInRange.length > 0 && (
                    <div className="duplicate-expected">
                      <p className="duplicate-expected-label">Expected IDs in this range:</p>
                      <p className="duplicate-expected-ids">{expectedIds.join(', ')}</p>
                      <p className="duplicate-expected-note">
                        {group.matchIndices.length} rows currently have {group.id}; all but one should have different IDs. Use <strong>Correct</strong> on the wrong rows above to assign the right station.
                      </p>
                    </div>
                    )}
                  </details>
                  )
                })
              })()}
            </section>
          ) : (
            <p className="no-duplicates-message">No duplicate IDs. All output IDs are unique.</p>
          )
          })()}
          {state.result.mismatchedMatchIndices && state.result.mismatchedMatchIndices.length > 0 && (
            <section className="mismatched-step-section" aria-labelledby="mismatched-heading">
              <h3 id="mismatched-heading" className="mismatched-step-section-title">Possible mis-matches</h3>
              <p className="mismatched-step-section-desc">These rows may be matched to the wrong station (e.g. low-confidence fuzzy or qualifier mismatch). Use <strong>Correct</strong> to fix.</p>
              <p className="rank-legend">
                <span className="rank-legend-from">From your file</span>
                <span className="rank-legend-arrow">→</span>
                <span className="rank-legend-to">Matched in database</span>
              </p>
              <div className="rank-matches no-match-cards">
                {state.result.mismatchedMatchIndices.map((matchIndex) => {
                  const match = state.result!.matches[matchIndex]
                  const fb = match.firebaseStation
                  const showConfidence = match.matchType === 'fuzzy' && match.confidence != null
                  const isCorrected = match.matchType === 'manual'
                  return (
                    <div key={matchIndex} className={`rank-match ${isCorrected ? 'rank-match-corrected' : ''}`}>
                      {showConfidence && (
                        <span className="match-confidence">{(match.confidence! * 100).toFixed(1)}%</span>
                      )}
                      <div className="station-details rank-from">
                        <span className="rank-label">From your file</span>
                        <div className="match-name-row">
                          <span className="match-name">{match.oldStation.stationName}</span>
                        </div>
                        <div className="match-location">
                          <small>
                            {formatStationLocationDisplay({
                              county: match.oldStation.county,
                              country: match.oldStation.country
                            })}
                          </small>
                        </div>
                      </div>
                      <div className="match-arrow">→</div>
                      <div className="station-details rank-to">
                        <span className="rank-label">Matched in database</span>
                        {fb ? (
                          <>
                            <div className="match-name-row">
                              {(fb.crsCode || fb.CrsCode) && <span className="match-crs">{fb.crsCode || fb.CrsCode}</span>}
                              <span className="match-name">{fb.stationName || fb.stationname}</span>
                            </div>
                            <div className="match-location">
                              <small>
                                {formatStationLocationDisplay({
                                  county: fb.county,
                                  country: fb.country,
                                  londonBorough: fb.londonBorough
                                })}
                              </small>
                            </div>
                            {fb.londonBorough && !isGreaterLondonCounty(fb.county) && (
                              <span className="match-borough">{fb.londonBorough}</span>
                            )}
                          </>
                        ) : (
                          <span className="match-empty">—</span>
                        )}
                      </div>
                      <div className="rank-match-button-wrapper">
                        <Button
                          onClick={() => handleOpenSearchModal(matchIndex)}
                          variant="wide"
                          width="hug"
                          className="rank-match-button"
                          ariaLabel={match.firebaseStation ? `Change matched station for ${match.oldStation.stationName}` : `Change station for ${match.oldStation.stationName}`}
                        >
                          {match.firebaseStation ? 'Re-correct' : 'Correct'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          <div className="action-buttons">
            <Button onClick={handleBackToReview} variant="wide" width="hug" className="action-button">
              Back to review
            </Button>
            <Button onClick={handleContinueToSummary} variant="wide" width="hug" className="action-button">
              Continue to summary
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {state.step === 'complete' && state.result && (
        <div className="migration-complete-container">
          {/* Success Header */}
          <div className="success-header">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
            </div>
            <h1>Summary</h1>
            <p className="success-subtitle">Matches made, duplicates, and output preview. Download your converted CSV below.</p>
          </div>

          {/* Migration Summary Cards */}
          <div className="migration-summary summary-grid">
            <div className="summary-card">
              <div className="card-content">
                <h3>Total</h3>
                <div className="card-number">{state.result.stats.total}</div>
                <p>Stations in output</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-content">
                <h3>Matched</h3>
                <div className="card-number">{state.result.stats.matched}</div>
                <p>Stations matched to database</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-content">
                <h3>Unmatched</h3>
                <div className="card-number">{state.result.stats.unmatched}</div>
                <p>No automatic match</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-content">
                <h3>Duplicate IDs</h3>
                <div className="card-number">{state.result.stats.duplicateIds}</div>
                <p>IDs on multiple rows</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-content">
                <h3>Rejected</h3>
                <div className="card-number">{state.result.stats.rejected}</div>
                <p>Not in England/Scotland/Wales</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-content">
                <h3>Data corrected</h3>
                <div className="card-number">{state.correctionsCount ?? 0}</div>
                <p>Manual corrections made</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-content">
                <h3>Stations visited</h3>
                <div className="card-number">{state.result.stats.visited ?? 0}</div>
                <p>Marked as visited in output</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-content">
                <h3>Favorites</h3>
                <div className="card-number">{state.result.stats.favorites ?? 0}</div>
                <p>Marked as favorite in output</p>
              </div>
            </div>
          </div>

          {/* Output Preview */}
          <div className="output-preview complete-output-preview">
            <h3>Output preview</h3>
            <div className="preview-section">
              <div className="preview-header">
                <div className="preview-header-text">
                  <h4>Converted data</h4>
                  <p className="preview-description">
                    Full converted data. Download the CSV below.
                  </p>
                </div>
                <Button
                  onClick={() => handleShowAllData('allData')}
                  variant="wide"
                  width="hug"
                  className="show-all-btn-desktop"
                >
                  {tableState.showAllAllData ? 'Show Less' : 'Show All Data'}
                </Button>
              </div>
              <div className="table-controls">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search stations..."
                    value={tableState.allDataSearch}
                    onChange={(e) => handleTableSearch('allData', e.target.value)}
                    className="table-search-input"
                  />
                  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <Button
                  onClick={() => handleShowAllData('allData')}
                  variant="wide"
                  width="hug"
                  className="show-all-btn-mobile"
                >
                  {tableState.showAllAllData ? 'Show Less' : 'Show All Data'}
                </Button>
              </div>
              <div className="preview-table-container">
                <table className="preview-table full-data">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Station Name</th>
                      <th>CRS Code</th>
                      <th>Country</th>
                      <th>County</th>
                      <th>TOC</th>
                      <th>Visited</th>
                      <th>Favorite</th>
                      <th>Years</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getDisplayData(state.result.converted, tableState.allDataSearch, tableState.showAllAllData).map((station, index) => {
                      const yearColumns = Object.keys(station).filter(key => /^\d{4}$/.test(key))
                      const yearData = yearColumns.map(year => `${year}: ${station[year] || '0'}`).join(', ')
                      return (
                        <tr key={index}>
                          <td className="id-cell">{station.id}</td>
                          <td className="name-cell">{station.stationname}</td>
                          <td className="crs-cell">{station.CrsCode || '-'}</td>
                          <td className="country-cell">{station.country}</td>
                          <td className="county-cell">{station.county}</td>
                          <td className="toc-cell">{station.TOC}</td>
                          <td className="visited-cell">{station['Is Visited']}</td>
                          <td className="favorite-cell">{station['Is Favorite']}</td>
                          <td className="years-cell" title={yearData}>
                            {yearColumns.length} years
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {getDisplayData(state.result.converted, tableState.allDataSearch, tableState.showAllAllData).length === 0 && (
                  <div className="no-results">
                    No stations found matching your search.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Features Added */}
          <div className="features-added">
            <h3>✨ What's New in Your Data</h3>
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div className="feature-content">
                  <h4>Unique Station IDs</h4>
                  <p>Each station now has a unique identifier for database integration</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div className="feature-content">
                  <h4>CRS & TIPLOC Codes</h4>
                  <p>Standard railway codes for accurate station identification</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div className="feature-content">
                  <h4>Structured Location Data</h4>
                  <p>Coordinates and location info in standardized JSON format</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                    <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                    <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
                    <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
                  </svg>
                </div>
                <div className="feature-content">
                  <h4>Database Integration</h4>
                  <p>Linked to comprehensive railway station database</p>
                </div>
              </div>
            </div>
          </div>

          {/* Download Section */}
          <div className="manual-download-section">
            <h3>Download your converted CSV</h3>
            <p className="manual-download-description">
              Click below to download the migrated stations file.
            </p>
            <div className="manual-download-button-container">
              <Button 
                onClick={handleDownload}
                variant="wide"
                width="hug"
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                }
              >
                Download converted CSV
              </Button>
            </div>
          </div>

          {/* New Stations Section */}
          {state.result.newStations && state.result.newStations.length > 0 && (
            <div className="new-stations-section">
              <div>
                <h3>🆕 New Stations Automatically Added ({state.result.newStations.length})</h3>
                <p className="section-description">
                  These stations (ID 2588+) were automatically added to your converted CSV from the cloud database.
                </p>
              </div>
              
              <div className="new-stations-list">
                <table className="new-stations-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Station Name</th>
                      <th>CRS Code</th>
                      <th>Country</th>
                      <th>County</th>
                      <th>TOC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.result.newStations.map((station, index) => (
                      <tr key={index}>
                        <td className="id-cell">{station.id}</td>
                        <td className="station-name-cell">{station.stationName || station.stationname}</td>
                        <td className="crs-cell">{station.crsCode || station.CrsCode || '-'}</td>
                        <td className="country-cell">{station.country || '-'}</td>
                        <td className="county-cell">{station.county || '-'}</td>
                        <td className="toc-cell">{station.toc || station.TOC || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="complete-actions">
            <Button 
              onClick={handleReset} 
              variant="wide"
              width="hug"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <path d="M16 13H8"/>
                  <path d="M16 17H8"/>
                  <path d="M10 9H9H8"/>
                  <path d="M21 15h-2a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>
                  <path d="M3 15h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H3"/>
                </svg>
              }
            >
              Convert Another File
            </Button>
            <Button 
              onClick={() => window.location.href = '/stations'} 
              variant="wide"
              width="hug"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              }
            >
              View Stations
            </Button>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {state.showProgressModal && (
        <div className="progress-modal-overlay">
          <div className="progress-modal">
            <div className="progress-modal-content">
              <div className="progress-header">
                <h3>Matching Stations</h3>
                <p>Please wait while we match your stations with the database...</p>
              </div>
              
              <div className="progress-circle-container">
                <div className="progress-circle">
                  <svg className="progress-ring" width="120" height="120">
                    <circle
                      className="progress-ring-circle"
                      stroke="var(--accent-color)"
                      strokeWidth="8"
                      fill="transparent"
                      r="52"
                      cx="60"
                      cy="60"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 52}`,
                        strokeDashoffset: `${2 * Math.PI * 52 * (1 - state.matchingProgress / 100)}`
                      }}
                    />
                  </svg>
                  <div className="progress-percentage">
                    {state.matchingProgress}%
                  </div>
                </div>
              </div>
              
              <div className="progress-details">
                <div className="current-station-info">
                  <strong>Current Station:</strong>
                  <span className="station-name">{state.currentStationName || 'Starting...'}</span>
                </div>
                <div className="progress-stats">
                  <span>Processing station data and finding matches</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Migration
