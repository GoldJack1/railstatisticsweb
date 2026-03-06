import React, { useState, useCallback } from 'react'
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
    selectedMatchIndex: null,
    showSearchModal: false,
    showProgressModal: false,
    matchingProgress: 0,
    currentStationName: '',
    detectedFormat: null,
    correctionsCount: 0
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
    setState(prev => ({ ...prev, step: 'duplicates' }))
  }, [])

  const handleBackToReview = useCallback(() => {
    setState(prev => ({ ...prev, step: 'review' }))
  }, [])

  const handleContinueToSummary = useCallback(() => {
    const duplicateIds = state.result?.stats?.duplicateIds ?? 0
    if (duplicateIds > 0 && !window.confirm(`You still have ${duplicateIds} duplicate ID(s). Continue to summary anyway?`)) {
      return
    }
    setState(prev => ({ ...prev, step: 'complete' }))
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
      selectedMatchIndex: null,
      showSearchModal: false,
      showProgressModal: false,
      matchingProgress: 0,
      currentStationName: '',
      detectedFormat: null,
      correctionsCount: 0
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
                          return (
                            <div key={index} className="rank-match">
                              <span className="match-confidence">{(match.confidence * 100).toFixed(1)}%</span>
                              <div className="station-details">
                                <span className="match-name">{match.oldStation.stationName}</span>
                                <div className="match-location">
                                  <small>{match.oldStation.country}, {match.oldStation.county}</small>
                                </div>
                              </div>
                              <div className="match-arrow">→</div>
                              {match.firebaseStation && (
                                <div className="station-details">
                                  <span className="match-name">{match.firebaseStation.stationName || match.firebaseStation.stationname}</span>
                                  <div className="match-location">
                                    <small>{match.firebaseStation.country}, {match.firebaseStation.county}</small>
                                  </div>
                                </div>
                              )}
                              <div className="rank-match-button-wrapper">
                                <Button 
                                  onClick={() => handleOpenSearchModal(originalIndex)}
                                  variant="wide"
                                  width="hug"
                                  className="rank-match-button"
                                  ariaLabel="Search for a different station"
                                >
                                  Correct
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
                          return (
                            <div key={index} className="rank-match">
                              <span className="match-confidence">{(match.confidence * 100).toFixed(1)}%</span>
                              <div className="station-details">
                                <span className="match-name">{match.oldStation.stationName}</span>
                                <div className="match-location">
                                  <small>{match.oldStation.country}, {match.oldStation.county}</small>
                                </div>
                              </div>
                              <div className="match-arrow">→</div>
                              {match.firebaseStation && (
                                <div className="station-details">
                                  <span className="match-name">{match.firebaseStation.stationName || match.firebaseStation.stationname}</span>
                                  <div className="match-location">
                                    <small>{match.firebaseStation.country}, {match.firebaseStation.county}</small>
                                  </div>
                                </div>
                              )}
                              <div className="rank-match-button-wrapper">
                                <Button 
                                  onClick={() => handleOpenSearchModal(originalIndex)}
                                  variant="wide"
                                  width="hug"
                                  className="rank-match-button"
                                  ariaLabel="Search for a different station"
                                >
                                  Correct
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

          {/* No matches – show all so user can correct */}
          {state.result.stats.unmatched > 0 && (() => {
            const noMatchEntries = state.result.matches
              .map((m, i) => ({ match: m, index: i }))
              .filter(({ match }) => match.matchType === 'none')
            return (
              <div className="no-matches-section rejected-stations-section">
                <div>
                  <h3>⚠️ No match ({noMatchEntries.length})</h3>
                  <p className="section-description">
                    These stations had no automatic match. Use <strong>Correct</strong> to search and pick the right station from the database.
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
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {noMatchEntries.map(({ match, index }) => (
                        <tr key={index}>
                          <td className="station-name-cell">{match.oldStation.stationName}</td>
                          <td className="country-cell">{match.oldStation.country}</td>
                          <td className="county-cell">{match.oldStation.county || '-'}</td>
                          <td className="operator-cell">{match.oldStation.operator || '-'}</td>
                          <td className="action-cell">
                            <Button
                              onClick={() => handleOpenSearchModal(index)}
                              variant="wide"
                              width="hug"
                              className="rank-match-button"
                              ariaLabel={`Search for a station to match ${match.oldStation.stationName}`}
                            >
                              Correct
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
          {state.result.duplicateGroups && state.result.duplicateGroups.length > 0 && state.result.outputIds ? (
            <>
              {state.result.duplicateGroups.map((group, gIdx) => {
                const idNum = parseInt(group.id, 10)
                const isNumeric = !isNaN(idNum)
                const rangeStart = isNumeric ? idNum - 2 : 0
                const rangeEnd = isNumeric ? idNum + 2 : 0
                const pad = (n: number) => (group.id.length >= 4 ? String(n).padStart(4, '0') : String(n))
                const expectedIds: string[] = isNumeric
                  ? Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => pad(rangeStart + i))
                  : [group.id]
                const idRangeSet = new Set(expectedIds)
                const indicesInRange = state.result!.outputIds
                  .map((id, k) => (idRangeSet.has(id) ? k : -1))
                  .filter((k) => k >= 0)
                const rangeLabel = expectedIds.length ? `${expectedIds[0]}–${expectedIds[expectedIds.length - 1]}` : group.id
                return (
                  <div key={gIdx} className="duplicate-group-block">
                    <h4 className="duplicate-group-title">Duplicate ID: {group.id} ({group.matchIndices.length} rows)</h4>
                    <p className="duplicate-range-label">Actual output — IDs {rangeLabel}</p>
                    <div className="rejected-stations-list">
                      <table className="rejected-table duplicate-ids-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>ID</th>
                            <th>Station Name</th>
                            <th>Country</th>
                            <th>County</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {indicesInRange.map((matchIndex) => {
                            const match = state.result!.matches[matchIndex]
                            const outputId = state.result!.outputIds[matchIndex]
                            return (
                              <tr key={matchIndex}>
                                <td className="row-num-cell">{matchIndex + 1}</td>
                                <td className="id-cell">{outputId}</td>
                                <td className="station-name-cell">{match.oldStation.stationName}</td>
                                <td className="country-cell">{match.oldStation.country}</td>
                                <td className="county-cell">{match.oldStation.county || '–'}</td>
                                <td className="action-cell">
                                  <Button
                                    onClick={() => handleOpenSearchModal(matchIndex)}
                                    variant="wide"
                                    width="hug"
                                    className="rank-match-button"
                                    ariaLabel={`Change station for ${match.oldStation.stationName}`}
                                  >
                                    Correct
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="duplicate-expected">
                      <p className="duplicate-expected-label">Expected IDs in this range:</p>
                      <p className="duplicate-expected-ids">{expectedIds.join(', ')}</p>
                      <p className="duplicate-expected-note">
                        {group.matchIndices.length} rows currently have {group.id}; all but one should have different IDs. Use <strong>Correct</strong> on the wrong rows above to assign the right station.
                      </p>
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <p className="no-duplicates-message">No duplicate IDs. All output IDs are unique.</p>
          )}
          {state.result.mismatchedMatchIndices && state.result.mismatchedMatchIndices.length > 0 && (
            <div className="mismatched-section duplicate-group-block">
              <h4 className="duplicate-group-title">Possible mis-matches ({state.result.mismatchedMatchIndices.length})</h4>
              <p className="step-description">These rows may be matched to the wrong station (e.g. low-confidence fuzzy or qualifier mismatch). Use <strong>Correct</strong> to fix.</p>
              <div className="rejected-stations-list">
                <table className="rejected-table duplicate-ids-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>CSV station</th>
                      <th>Matched to</th>
                      <th>Confidence</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.result.mismatchedMatchIndices.map((matchIndex) => {
                      const match = state.result!.matches[matchIndex]
                      const fbName = match.firebaseStation?.stationName ?? match.firebaseStation?.stationname ?? '–'
                      return (
                        <tr key={matchIndex}>
                          <td className="row-num-cell">{matchIndex + 1}</td>
                          <td className="station-name-cell">{match.oldStation.stationName}</td>
                          <td className="station-name-cell">{fbName}</td>
                          <td className="id-cell">{match.matchType === 'fuzzy' ? `${Math.round((match.confidence ?? 0) * 100)}%` : '–'}</td>
                          <td className="action-cell">
                            <Button
                              onClick={() => handleOpenSearchModal(matchIndex)}
                              variant="wide"
                              width="hug"
                              className="rank-match-button"
                              ariaLabel={`Change station for ${match.oldStation.stationName}`}
                            >
                              Correct
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
