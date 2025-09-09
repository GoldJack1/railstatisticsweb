import React, { useState, useCallback } from 'react'
import { useStations } from '../hooks/useStations'
import { 
  parseOldFormatCSV, 
  matchStations, 
  generateMigrationResult, 
  downloadCSV
} from '../services/migration'
import type { MigrationState } from '../types/migration'
import './Migration.css'

const Migration: React.FC = () => {
  const { stations: firebaseStations, loading: firebaseLoading, refetch } = useStations()
  const [state, setState] = useState<MigrationState>({
    file: null,
    oldFormatData: [],
    firebaseStations: [],
    matches: [],
    result: null,
    loading: false,
    error: null,
    step: 'upload',
    // Search functionality
    searchQuery: '',
    searchResults: [],
    selectedMatchIndex: null,
    showSearchModal: false,
    // Progress tracking
    showProgressModal: false,
    matchingProgress: 0,
    currentStationName: ''
  })

  // Table search and display state
  const [tableState, setTableState] = useState({
    finalDataSearch: '',
    allDataSearch: '',
    showAllFinalData: false,
    showAllAllData: false
  })

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
        const oldFormatData = parseOldFormatCSV(csvContent)
        setState(prev => ({ 
          ...prev, 
          oldFormatData, 
          step: 'matching',
          error: null 
        }))
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          error: `Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }))
      }
    }
    reader.readAsText(file)
  }, [])

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
      const matches = await matchStations(state.oldFormatData, (progress, currentStation) => {
        setState(prev => ({
          ...prev,
          matchingProgress: progress,
          currentStationName: currentStation
        }))
      })
      const result = generateMigrationResult(matches)
      
      setState(prev => ({ 
        ...prev, 
        matches, 
        result, 
        step: 'review',
        loading: false,
        showProgressModal: false
      }))
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Error matching stations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        loading: false,
        showProgressModal: false
      }))
    }
  }, [state.oldFormatData])

  const handleDownload = useCallback(() => {
    if (!state.result) return
    downloadCSV(state.result.converted, 'migrated-stations.csv')
    setState(prev => ({ ...prev, step: 'complete' }))
  }, [state.result])



  const handleReset = useCallback(() => {
    setState({
      file: null,
      oldFormatData: [],
      firebaseStations: [],
      matches: [],
      result: null,
      loading: false,
      error: null,
      step: 'upload',
      // Search functionality
      searchQuery: '',
      searchResults: [],
      selectedMatchIndex: null,
      showSearchModal: false,
      // Progress tracking
      showProgressModal: false,
      matchingProgress: 0,
      currentStationName: ''
    })
  }, [])

  // Search functionality
  const handleSearchStations = useCallback((query: string) => {
    if (!query.trim()) {
      setState(prev => ({ ...prev, searchResults: [] }))
      return
    }

    const results = firebaseStations.filter(station => {
      const stationName = station.stationName || ''
      const crsCode = station.crsCode || ''
      const tiploc = station.tiploc || ''
      
      return stationName.toLowerCase().includes(query.toLowerCase()) ||
             crsCode.toLowerCase().includes(query.toLowerCase()) ||
             tiploc.toLowerCase().includes(query.toLowerCase())
    })

    setState(prev => ({ 
      ...prev, 
      searchQuery: query,
      searchResults: results.slice(0, 10) // Limit to 10 results
    }))
  }, [firebaseStations])

  const handleSelectStation = useCallback((matchIndex: number, selectedStation: any) => {
    setState(prev => {
      const newMatches = [...prev.matches]
      newMatches[matchIndex] = {
        ...newMatches[matchIndex],
        firebaseStation: selectedStation,
        matchType: 'manual' as any,
        confidence: 1.0,
        suggestedId: selectedStation.id || '',
        suggestedCrsCode: selectedStation.crsCode || '',
        suggestedTiploc: selectedStation.tiploc || ''
      }
      
      const newResult = generateMigrationResult(newMatches)
      
      return {
        ...prev,
        matches: newMatches,
        result: newResult,
        showSearchModal: false,
        selectedMatchIndex: null,
        searchQuery: '',
        searchResults: []
      }
    })
  }, [])

  const handleOpenSearchModal = useCallback((matchIndex: number) => {
    setState(prev => ({
      ...prev,
      selectedMatchIndex: matchIndex,
      showSearchModal: true,
      searchQuery: '',
      searchResults: []
    }))
  }, [])

  const handleCloseSearchModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      showSearchModal: false,
      selectedMatchIndex: null,
      searchQuery: '',
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

  const handleUseLocalData = useCallback(() => {
    console.log('Button clicked - switching to local data')
    localStorage.setItem('useLocalDataOnly', 'true')
    console.log('Local storage set, refetching stations...')
    refetch() // Refetch stations with new localStorage setting
  }, [refetch])

  // Debug logging
  console.log('Migration component render - firebaseLoading:', firebaseLoading)

  if (firebaseLoading) {
    console.log('Showing loading screen with local data button')
    return (
      <div className="migration-container">
        <div className="loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading Firebase stations...</p>
          </div>
          <div className="loading-options">
            <p>Having trouble connecting to Firebase?</p>
            <button 
              onClick={handleUseLocalData}
              className="btn btn-secondary"
            >
              Use Local Data Instead
            </button>
          </div>
        </div>
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
        <div className="data-source-controls">
          <button 
            onClick={handleUseLocalData}
            className="btn btn-secondary btn-sm"
            title="Switch to local data if Firebase is having issues"
          >
            Use Local Data
          </button>
        </div>
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
          <div className="upload-area">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="file-input"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="file-label">
              {state.file ? state.file.name : 'Choose CSV file'}
            </label>
            {state.file && (
              <div className="file-info">
                <p>File selected: {state.file.name}</p>
                <p>Size: {(state.file.size / 1024).toFixed(1)} KB</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Matching */}
      {state.step === 'matching' && (
        <div className="migration-step">
          <h2>Step 2: Station Matching</h2>
          <div className="matching-info">
            <p>Found {state.oldFormatData.length} stations in the uploaded file</p>
            <p>Available {firebaseStations.length} stations for matching (Firebase/Local data)</p>
            <p className="data-source-info">
              <small>
                Data source: {firebaseStations.length > 0 ? 
                  (localStorage.getItem('useLocalDataOnly') === 'true' ? 'Local Data' : 'Firebase with Local Fallback') : 
                  'No data available'}
              </small>
            </p>
            <button 
              onClick={handleStartMatching}
              disabled={state.loading}
              className="btn btn-primary"
            >
              {state.loading ? 'Matching...' : 'Start Matching'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review Results */}
      {state.step === 'review' && state.result && (
        <div className="migration-step">
          <h2>Step 3: Review Results</h2>
          
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
            <div className="stat-card">
              <h3>Exact Matches</h3>
              <span className="stat-number">{state.result.stats.exactMatches}</span>
            </div>
            <div className="stat-card visited">
              <h3>Visited</h3>
              <span className="stat-number">{state.result.stats.visited}</span>
            </div>
            <div className="stat-card favorites">
              <h3>Favorites</h3>
              <span className="stat-number">{state.result.stats.favorites}</span>
            </div>
          </div>

          <div className="match-breakdown">
            <h3>Match Types</h3>
            <ul>
              <li>Exact matches: {state.result.stats.exactMatches}</li>
              <li>Fuzzy matches: {state.result.stats.fuzzyMatches}</li>
              <li>Coordinate matches: {state.result.stats.coordinateMatches}</li>
              <li>No matches: {state.result.stats.unmatched}</li>
            </ul>
          </div>

          {/* Fuzzy Match Confidence Rankings */}
          {state.result.stats.fuzzyMatches > 0 && (
            <div className="fuzzy-match-ranks">
              <h3>Fuzzy Match Confidence Rankings</h3>
              <div className="confidence-ranks">
                {/* Green - High Confidence (80%+) */}
                {(() => {
                  const greenMatches = state.result.matches.filter(m => 
                    m.matchType === 'fuzzy' && m.confidence >= 0.8
                  )
                  return greenMatches.length > 0 && (
                    <div className="confidence-rank green">
                      <div className="rank-header">
                        <span className="rank-indicator green"></span>
                        <h4>High Confidence (80%+)</h4>
                        <span className="rank-count">{greenMatches.length}</span>
                      </div>
                      <div className="rank-matches">
                        {greenMatches.slice(0, 5).map((match, index) => {
                          const originalIndex = state.result?.matches.findIndex(m => m === match) ?? -1
                          return (
                            <div key={index} className="rank-match">
                              <div className="match-info">
                                <span className="match-name">{match.oldStation.stationName}</span>
                                <span className="match-confidence">{(match.confidence * 100).toFixed(1)}%</span>
                              </div>
                              {match.firebaseStation && (
                                <span className="match-target">
                                  → {match.firebaseStation.stationName || match.firebaseStation.stationname}
                                </span>
                              )}
                              <button 
                                onClick={() => handleOpenSearchModal(originalIndex)}
                                className="btn btn-sm btn-outline search-btn"
                                title="Search for a different station"
                              >
                                🔍 Search
                              </button>
                            </div>
                          )
                        })}
                        {greenMatches.length > 5 && (
                          <div className="more-matches">... and {greenMatches.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  )
                })()}

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
                          return (
                            <div key={index} className="rank-match">
                              <div className="match-info">
                                <span className="match-name">{match.oldStation.stationName}</span>
                                <span className="match-confidence">{(match.confidence * 100).toFixed(1)}%</span>
                              </div>
                              {match.firebaseStation && (
                                <span className="match-target">
                                  → {match.firebaseStation.stationName || match.firebaseStation.stationname}
                                </span>
                              )}
                              <button 
                                onClick={() => handleOpenSearchModal(originalIndex)}
                                className="btn btn-sm btn-outline search-btn"
                                title="Search for a different station"
                              >
                                🔍 Search
                              </button>
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
                          return (
                            <div key={index} className="rank-match">
                              <div className="match-info">
                                <span className="match-name">{match.oldStation.stationName}</span>
                                <span className="match-confidence">{(match.confidence * 100).toFixed(1)}%</span>
                              </div>
                              {match.firebaseStation && (
                                <span className="match-target">
                                  → {match.firebaseStation.stationName || match.firebaseStation.stationname}
                                </span>
                              )}
                              <button 
                                onClick={() => handleOpenSearchModal(originalIndex)}
                                className="btn btn-sm btn-outline search-btn"
                                title="Search for a different station"
                              >
                                🔍 Search
                              </button>
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

          {/* Output Preview */}
          <div className="output-preview">
            <h3>Output Preview</h3>
            
            {/* Final Data Preview (excluding yearly usage) */}
            <div className="preview-section">
              <h4>Final Data (excluding yearly usage)</h4>
              <p className="preview-description">
                This shows the converted data with core station information, excluding yearly usage statistics.
              </p>
              
              {/* Search and controls */}
              <div className="table-controls">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search stations..."
                    value={tableState.finalDataSearch}
                    onChange={(e) => handleTableSearch('finalData', e.target.value)}
                    className="table-search-input"
                  />
                  <span className="search-icon">🔍</span>
                </div>
                <button
                  onClick={() => handleShowAllData('finalData')}
                  className="btn btn-outline show-all-btn"
                >
                  {tableState.showAllFinalData ? 'Show Less' : 'Show All Data'}
                </button>
              </div>

              <div className="preview-table-container">
                <table className="preview-table">
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
                    </tr>
                  </thead>
                  <tbody>
                    {getDisplayData(state.result.converted, tableState.finalDataSearch, tableState.showAllFinalData).map((station, index) => (
                      <tr key={index}>
                        <td className="id-cell">{station.id}</td>
                        <td className="name-cell">{station.stationname}</td>
                        <td className="crs-cell">{station.CrsCode || '-'}</td>
                        <td className="country-cell">{station.country}</td>
                        <td className="county-cell">{station.county}</td>
                        <td className="toc-cell">{station.TOC}</td>
                        <td className="visited-cell">{station['Is Visited']}</td>
                        <td className="favorite-cell">{station['Is Favorite']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {getDisplayData(state.result.converted, tableState.finalDataSearch, tableState.showAllFinalData).length === 0 && (
                  <div className="no-results">
                    No stations found matching your search.
                  </div>
                )}
              </div>
            </div>

            {/* All Data Preview (including yearly usage) */}
            <div className="preview-section">
              <h4>All Data (including yearly usage)</h4>
              <p className="preview-description">
                This shows the complete converted data including all yearly usage statistics.
              </p>
              
              {/* Search and controls */}
              <div className="table-controls">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search stations..."
                    value={tableState.allDataSearch}
                    onChange={(e) => handleTableSearch('allData', e.target.value)}
                    className="table-search-input"
                  />
                  <span className="search-icon">🔍</span>
                </div>
                <button
                  onClick={() => handleShowAllData('allData')}
                  className="btn btn-outline show-all-btn"
                >
                  {tableState.showAllAllData ? 'Show Less' : 'Show All Data'}
                </button>
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
                      // Get year columns
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

          <div className="action-buttons">
            <button onClick={handleDownload} className="btn btn-success">
              Download Converted CSV
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
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
            <h1>Migration Complete!</h1>
            <p className="success-subtitle">Your CSV file has been successfully converted and downloaded</p>
          </div>

          {/* Migration Summary Cards */}
          <div className="migration-summary">
            <div className="summary-card primary">
              <div className="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
              </div>
              <div className="card-content">
                <h3>Total Stations</h3>
                <div className="card-number">{state.result.stats.total}</div>
                <p>Stations processed from your CSV</p>
              </div>
            </div>

            <div className="summary-card success">
              <div className="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4"/>
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              </div>
              <div className="card-content">
                <h3>Successfully Matched</h3>
                <div className="card-number">{state.result.stats.matched}</div>
                <p>Stations linked to database</p>
              </div>
            </div>

            <div className="summary-card warning">
              <div className="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div className="card-content">
                <h3>Unmatched</h3>
                <div className="card-number">{state.result.stats.unmatched}</div>
                <p>Stations without database links</p>
              </div>
            </div>
          </div>

          {/* Match Breakdown */}
          <div className="match-breakdown-detailed">
            <h3>Match Breakdown</h3>
            <div className="breakdown-grid">
              <div className="breakdown-item exact">
                <span className="breakdown-label">Exact Matches</span>
                <span className="breakdown-count">{state.result.stats.exactMatches}</span>
              </div>
              <div className="breakdown-item fuzzy">
                <span className="breakdown-label">Fuzzy Matches</span>
                <span className="breakdown-count">{state.result.stats.fuzzyMatches}</span>
              </div>
              <div className="breakdown-item coordinates">
                <span className="breakdown-label">Coordinate Matches</span>
                <span className="breakdown-count">{state.result.stats.coordinateMatches}</span>
              </div>
              <div className="breakdown-item manual">
                <span className="breakdown-label">Manual Matches</span>
                <span className="breakdown-count">{state.matches.filter(m => m.matchType === 'manual').length}</span>
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

          {/* Action Buttons */}
          <div className="complete-actions">
            <button onClick={handleReset} className="btn btn-primary btn-large">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <path d="M16 13H8"/>
                <path d="M16 17H8"/>
                <path d="M10 9H9H8"/>
                <path d="M21 15h-2a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>
                <path d="M3 15h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H3"/>
              </svg>
              Convert Another File
            </button>
            <button onClick={() => window.location.href = '/stations'} className="btn btn-outline btn-large">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              View Stations
            </button>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {state.showSearchModal && state.selectedMatchIndex !== null && (
        <div className="search-modal-overlay">
          <div className="search-modal">
            <div className="search-modal-header">
              <h3>Search for Station</h3>
              <button 
                onClick={handleCloseSearchModal}
                className="close-button"
              >
                ×
              </button>
            </div>
            
            <div className="search-modal-content">
              <div className="current-station">
                <h4>Current Station:</h4>
                <p><strong>{state.matches[state.selectedMatchIndex]?.oldStation.stationName}</strong></p>
                <p>{state.matches[state.selectedMatchIndex]?.oldStation.country}, {state.matches[state.selectedMatchIndex]?.oldStation.county}</p>
              </div>

              <div className="search-input">
                <input
                  type="text"
                  placeholder="Search by station name, CRS code, or TIPLOC..."
                  value={state.searchQuery}
                  onChange={(e) => handleSearchStations(e.target.value)}
                  className="search-field"
                  autoFocus
                />
              </div>

              <div className="search-results">
                {state.searchResults.length > 0 ? (
                  <div className="results-list">
                    {state.searchResults.map((station, index) => (
                      <div 
                        key={index} 
                        className="search-result-item"
                        onClick={() => handleSelectStation(state.selectedMatchIndex!, station)}
                      >
                        <div className="result-station-name">
                          {station.stationName}
                        </div>
                        <div className="result-details">
                          <span className="result-crs">{station.crsCode}</span>
                          <span className="result-tiploc">{station.tiploc}</span>
                          <span className="result-location">{station.country}, {station.county}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : state.searchQuery ? (
                  <div className="no-results">
                    No stations found matching "{state.searchQuery}"
                  </div>
                ) : (
                  <div className="search-hint">
                    Start typing to search for stations...
                  </div>
                )}
              </div>
            </div>
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
