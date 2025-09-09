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
  const { stations: firebaseStations, loading: firebaseLoading } = useStations()
  const [state, setState] = useState<MigrationState>({
    file: null,
    oldFormatData: [],
    firebaseStations: [],
    matches: [],
    result: null,
    loading: false,
    error: null,
    step: 'upload'
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

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const matches = await matchStations(state.oldFormatData)
      const result = generateMigrationResult(matches)
      
      setState(prev => ({ 
        ...prev, 
        matches, 
        result, 
        step: 'review',
        loading: false 
      }))
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Error matching stations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        loading: false 
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
      step: 'upload'
    })
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

  if (firebaseLoading) {
    return (
      <div className="migration-container">
        <div className="loading">Loading Firebase stations...</div>
      </div>
    )
  }

  return (
    <div className="migration-container">
      <div className="migration-header">
        <h1>CSV Migration Tool</h1>
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

          <div className="matches-preview">
            <h3>Sample Matches</h3>
            <div className="matches-list">
              {state.result.matches.slice(0, 10).map((match, index) => (
                <div key={index} className={`match-item ${match.matchType}`}>
                  <div className="match-info">
                    <strong>{match.oldStation.stationName}</strong>
                    <span className="match-type">{match.matchType}</span>
                    <span className="confidence">{(match.confidence * 100).toFixed(1)}%</span>
                  </div>
                  {match.firebaseStation && (
                    <div className="firebase-info">
                      Matched with: {match.firebaseStation.stationName || match.firebaseStation.stationname}
                      <br />
                      ID: {match.suggestedId} | CRS: {match.suggestedCrsCode}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {state.result.matches.length > 10 && (
              <p>... and {state.result.matches.length - 10} more matches</p>
            )}
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
      {state.step === 'complete' && (
        <div className="migration-step">
          <h2>Migration Complete!</h2>
          <div className="success-message">
            <p>✅ Your CSV file has been successfully converted and downloaded.</p>
            <p>The new format includes:</p>
            <ul>
              <li>Unique IDs for each station</li>
              <li>CRS codes and TIPLOC codes where available</li>
              <li>Structured location data in JSON format</li>
              <li>Standardized field names</li>
              <li>Matched data from Firebase stations</li>
            </ul>
          </div>
          <button onClick={handleReset} className="btn btn-primary">
            Convert Another File
          </button>
        </div>
      )}
    </div>
  )
}

export default Migration
