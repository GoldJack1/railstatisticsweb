import React, { useState, useMemo } from 'react'
import { useStations } from '../hooks/useStations'
import './Stations.css'

const Stations: React.FC = () => {
  const { stations, loading, error, stats } = useStations()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredStations = useMemo(() => {
    if (!searchTerm.trim()) {
      return stations
    }

    const term = searchTerm.toLowerCase()
    return stations.filter(station => 
      (station.stationName && station.stationName.toLowerCase().includes(term)) ||
      (station.crsCode && station.crsCode.toLowerCase().includes(term)) ||
      (station.tiploc && station.tiploc.toLowerCase().includes(term)) ||
      (station.country && station.country.toLowerCase().includes(term)) ||
      (station.county && station.county.toLowerCase().includes(term)) ||
      (station.toc && station.toc.toLowerCase().includes(term)) ||
      (station.stnarea && station.stnarea.toLowerCase().includes(term)) ||
      (station.id && station.id.toLowerCase().includes(term))
    )
  }, [stations, searchTerm])

  const formatYearlyPassengers = (passengers: any): string => {
    if (!passengers) return 'N/A'
    
    // If it's already a number, format it
    if (typeof passengers === 'number') {
      return passengers.toLocaleString()
    }
    
    // If it's an object with year-based data
    if (typeof passengers === 'object') {
      // Check if it's a year-based object (keys are years)
      const years = Object.keys(passengers)
      if (years.length > 0 && /^\d{4}$/.test(years[0])) {
        // Sort years in descending order (most recent first)
        const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a))
        
        // Create a formatted display showing all years
        const yearEntries = sortedYears.map(year => {
          const count = passengers[year]
          if (typeof count === 'number') {
            return `${year}: ${count.toLocaleString()}`
          }
          return `${year}: N/A`
        })
        
        // Show up to 5 most recent years, with "..." if there are more
        if (yearEntries.length <= 5) {
          return yearEntries.join('\n')
        } else {
          return yearEntries.slice(0, 5).join('\n') + '\n...and ' + (yearEntries.length - 5) + ' more years'
        }
      }
      
      // Check common property names that might contain the number
      const possibleKeys = ['value', 'count', 'total', 'passengers', 'number']
      for (const key of possibleKeys) {
        if (passengers[key] && typeof passengers[key] === 'number') {
          return passengers[key].toLocaleString()
        }
      }
      
      // If no number found, show the object structure for debugging
      return `Object: ${JSON.stringify(passengers).substring(0, 50)}...`
    }
    
    // If it's a string, try to parse it as a number
    if (typeof passengers === 'string') {
      const num = parseFloat(passengers)
      if (!isNaN(num)) {
        return num.toLocaleString()
      }
      return passengers
    }
    
    return 'N/A'
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading stations from Firebase...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginBottom: '0.5rem'}}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h3>Failed to Load Stations</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      {/* Page Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Station Database</h1>
          <p style={{color: 'var(--text-secondary)', margin: '0.5rem 0 0 0'}}>Explore railway stations and passenger data</p>
        </div>
      </header>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.totalStations.toLocaleString()}</div>
          <div className="stat-label">Total Stations</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.withCoordinates.toLocaleString()}</div>
          <div className="stat-label">With Coordinates</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.withTOC.toLocaleString()}</div>
          <div className="stat-label">With TOC</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.withPassengers.toLocaleString()}</div>
          <div className="stat-label">With Passenger Data</div>
        </div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-container">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input" 
            placeholder="Search stations by name, code, TOC, or location..."
            autoComplete="off"
          />
        </div>
      </div>

      {/* No Results State */}
      {filteredStations.length === 0 && searchTerm && (
        <div className="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>No Stations Found</h3>
          <p>Try adjusting your search terms or clear the search to see all stations.</p>
        </div>
      )}

      {/* Stations Grid */}
      {filteredStations.length > 0 && (
        <div className="stations-grid">
          {filteredStations.map(station => (
            <div key={station.id} className="station-card">
              <div className="station-header">
                <h3 className="station-name">{station.stationName || 'Unknown Station'}</h3>
                {station.crsCode && <span className="station-crs">{station.crsCode}</span>}
              </div>
              
              <div className="station-details">
                <div className="detail-item">
                  <span className="detail-label">Station ID</span>
                  <span className="detail-value">{station.id || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Country</span>
                  <span className="detail-value">{station.country || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">County</span>
                  <span className="detail-value">{station.county || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">TOC</span>
                  <span className="detail-value">{station.toc || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Tiploc</span>
                  <span className="detail-value">{station.tiploc || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Station Area</span>
                  <span className="detail-value">{station.stnarea || 'N/A'}</span>
                </div>
              </div>
              
              <div className="coordinates">
                <div className="detail-item">
                  <span className="detail-label">Coordinates</span>
                  <span className="detail-value">
                    {station.latitude !== 0 && station.longitude !== 0 
                      ? `${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)}`
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
              
              {station.yearlyPassengers && (
                <div className="yearly-passengers">
                  <div className="detail-item">
                    <span className="detail-label">Yearly Passengers</span>
                    <span className="detail-value" style={{whiteSpace: 'pre-line'}}>
                      {formatYearlyPassengers(station.yearlyPassengers)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Stations
