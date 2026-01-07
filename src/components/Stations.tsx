import React, { useState, useMemo } from 'react'
import { useStations } from '../hooks/useStations'
import { useDebounce } from '../hooks/useDebounce'
import StationModal from './StationModal'
import type { Station } from '../types'
import './Stations.css'

type SortOption = 'name-asc' | 'name-desc' | 'passengers-asc' | 'passengers-desc' | 'toc-asc' | 'toc-desc'

const Stations: React.FC = () => {
  const { stations, loading, error, stats } = useStations()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTOC, setSelectedTOC] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCounty, setSelectedCounty] = useState<string>('')
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const itemsPerPage = 24

  // Get unique filter options
  const uniqueTOCs = useMemo(() => {
    const tocs = new Set<string>()
    stations.forEach(station => {
      if (station.toc) tocs.add(station.toc)
    })
    return Array.from(tocs).sort()
  }, [stations])

  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>()
    stations.forEach(station => {
      if (station.country) countries.add(station.country)
    })
    return Array.from(countries).sort()
  }, [stations])

  const uniqueCounties = useMemo(() => {
    const counties = new Set<string>()
    stations.forEach(station => {
      if (station.county) counties.add(station.county)
    })
    return Array.from(counties).sort()
  }, [stations])

  // Filter and sort stations
  const filteredAndSortedStations = useMemo(() => {
    let filtered = stations

    // Text search
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(station => 
        (station.stationName && station.stationName.toLowerCase().includes(term)) ||
        (station.crsCode && station.crsCode.toLowerCase().includes(term)) ||
        (station.tiploc && station.tiploc.toLowerCase().includes(term)) ||
        (station.country && station.country.toLowerCase().includes(term)) ||
        (station.county && station.county.toLowerCase().includes(term)) ||
        (station.toc && station.toc.toLowerCase().includes(term)) ||
        (station.stnarea && station.stnarea.toLowerCase().includes(term)) ||
        (station.id && station.id.toLowerCase().includes(term))
      )
    }

    // Filter by TOC
    if (selectedTOC) {
      filtered = filtered.filter(station => station.toc === selectedTOC)
    }

    // Filter by Country
    if (selectedCountry) {
      filtered = filtered.filter(station => station.country === selectedCountry)
    }

    // Filter by County
    if (selectedCounty) {
      filtered = filtered.filter(station => station.county === selectedCounty)
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return (a.stationName || '').localeCompare(b.stationName || '')
        case 'name-desc':
          return (b.stationName || '').localeCompare(a.stationName || '')
        case 'toc-asc':
          return (a.toc || '').localeCompare(b.toc || '')
        case 'toc-desc':
          return (b.toc || '').localeCompare(a.toc || '')
        case 'passengers-asc':
        case 'passengers-desc': {
          const getLatestPassengers = (station: Station): number => {
            if (!station.yearlyPassengers || typeof station.yearlyPassengers !== 'object') return 0
            const years = Object.keys(station.yearlyPassengers)
              .filter(y => /^\d{4}$/.test(y))
              .sort((a, b) => parseInt(b) - parseInt(a))
            if (years.length === 0) return 0
            const latest = station.yearlyPassengers[years[0]]
            return typeof latest === 'number' ? latest : 0
          }
          const aPassengers = getLatestPassengers(a)
          const bPassengers = getLatestPassengers(b)
          return sortOption === 'passengers-asc' 
            ? aPassengers - bPassengers 
            : bPassengers - aPassengers
        }
        default:
          return 0
      }
    })

    return sorted
  }, [stations, debouncedSearchTerm, selectedTOC, selectedCountry, selectedCounty, sortOption])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedStations.length / itemsPerPage)
  const paginatedStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedStations.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedStations, currentPage, itemsPerPage])

  // Reset to first page when filters change
  // Use searchTerm (not debouncedSearchTerm) to ensure immediate reset on any filter change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedTOC, selectedCountry, selectedCounty, sortOption])

  const handleStationClick = (station: Station) => {
    setSelectedStation(station)
    setIsModalOpen(true)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedTOC('')
    setSelectedCountry('')
    setSelectedCounty('')
    setSortOption('name-asc')
  }

  // Count active data filters (excludes UI state like showFilters)
  const activeFilterCount = [searchTerm, selectedTOC, selectedCountry, selectedCounty].filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading data from Cloud Database...</p>
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

      {/* Search and Filters Section */}
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
          {hasActiveFilters && (
            <button 
              className="clear-search-button"
              onClick={clearFilters}
              aria-label="Clear filters"
              title="Clear all filters"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="controls-row">
          <button 
            className="filter-toggle-button"
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
            {hasActiveFilters && <span className="filter-badge">{activeFilterCount}</span>}
          </button>

          <div className="sort-container">
            <label htmlFor="sort-select" className="sort-label">Sort by:</label>
            <select 
              id="sort-select"
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="sort-select"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="toc-asc">TOC (A-Z)</option>
              <option value="toc-desc">TOC (Z-A)</option>
              <option value="passengers-desc">Passengers (High to Low)</option>
              <option value="passengers-asc">Passengers (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group">
              <label htmlFor="toc-filter" className="filter-label">TOC (Train Operating Company)</label>
              <select 
                id="toc-filter"
                value={selectedTOC} 
                onChange={(e) => setSelectedTOC(e.target.value)}
                className="filter-select"
              >
                <option value="">All TOCs</option>
                {uniqueTOCs.map(toc => (
                  <option key={toc} value={toc}>{toc}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="country-filter" className="filter-label">Country</label>
              <select 
                id="country-filter"
                value={selectedCountry} 
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="filter-select"
              >
                <option value="">All Countries</option>
                {uniqueCountries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="county-filter" className="filter-label">County</label>
              <select 
                id="county-filter"
                value={selectedCounty} 
                onChange={(e) => setSelectedCounty(e.target.value)}
                className="filter-select"
              >
                <option value="">All Counties</option>
                {uniqueCounties.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="results-count">
          Showing {paginatedStations.length} of {filteredAndSortedStations.length} stations
          {filteredAndSortedStations.length !== stations.length && (
            <span className="filtered-indicator"> (filtered)</span>
          )}
        </div>
      </div>

      {/* No Results State */}
      {filteredAndSortedStations.length === 0 && (debouncedSearchTerm || selectedTOC || selectedCountry || selectedCounty) && (
        <div className="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>No Stations Found</h3>
          <p>Try adjusting your search terms or filters to see more stations.</p>
          <button className="clear-filters-button" onClick={clearFilters}>
            Clear All Filters
          </button>
        </div>
      )}

      {/* Stations Grid */}
      {paginatedStations.length > 0 && (
        <>
          <div className="stations-grid">
            {paginatedStations.map(station => (
              <div 
                key={station.id} 
                className="station-card"
                onClick={() => handleStationClick(station)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleStationClick(station)
                  }
                }}
                aria-label={`View details for ${station.stationName || 'Unknown Station'}`}
              >
                <div className="station-header">
                  <h3 className="station-name">{station.stationName || 'Unknown Station'}</h3>
                  {station.crsCode && <span className="station-crs">{station.crsCode}</span>}
                </div>
                
                <div className="station-details">
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
                </div>
                
                {station.yearlyPassengers && (
                  <div className="yearly-passengers">
                    <div className="detail-item">
                      <span className="detail-label">Latest Year Passengers</span>
                      <span className="detail-value">
                        {(() => {
                          if (typeof station.yearlyPassengers === 'object') {
                            const years = Object.keys(station.yearlyPassengers)
                              .filter(y => /^\d{4}$/.test(y))
                              .sort((a, b) => parseInt(b) - parseInt(a))
                            if (years.length > 0) {
                              const latest = station.yearlyPassengers[years[0]]
                              return typeof latest === 'number' ? latest.toLocaleString() : 'N/A'
                            }
                          }
                          return 'N/A'
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="station-card-footer">
                  <span className="view-details-text">Click to view full details</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Previous
              </button>
              
              <div className="pagination-info">
                Page {currentPage} of {totalPages}
              </div>
              
              <button 
                className="pagination-button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Station Detail Modal */}
      <StationModal 
        station={selectedStation}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedStation(null)
        }}
      />
    </div>
  )
}

export default Stations
