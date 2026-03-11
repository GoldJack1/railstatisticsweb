import React, { useState, useMemo, useRef, useCallback } from 'react'
import { useStations } from '../hooks/useStations'
import { useDebounce } from '../hooks/useDebounce'
import StationEditModal from './StationEditModal'
import type { Station } from '../types'
import { formatFareZoneDisplay } from '../utils/formatFareZone'
import { formatStationLocationDisplay, isGreaterLondonCounty } from '../utils/formatStationLocation'
import './Stations.css'

type SortOption = 'name-asc' | 'name-desc' | 'passengers-asc' | 'passengers-desc' | 'toc-asc' | 'toc-desc'

const StationDatabaseEdit: React.FC = () => {
  const { stations, loading, error, stats, refetch } = useStations()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTOC, setSelectedTOC] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCounty, setSelectedCounty] = useState<string>('')
  const [selectedLondonBorough, setSelectedLondonBorough] = useState<string>('')
  const [selectedFareZone, setSelectedFareZone] = useState<string>('')
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const resultsSectionRef = useRef<HTMLDivElement>(null)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const scrollToResults = useCallback(() => {
    resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const itemsPerPage = 24

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

  const uniqueLondonBoroughs = useMemo(() => {
    const boroughs = new Set<string>()
    stations.forEach(station => {
      if (station.londonBorough) boroughs.add(station.londonBorough)
    })
    return Array.from(boroughs).sort()
  }, [stations])

  const uniqueFareZones = useMemo(() => {
    const zones = new Set<string>()
    stations.forEach(station => {
      if (station.fareZone) zones.add(station.fareZone)
    })
    return Array.from(zones).sort((a, b) => {
      const na = parseInt(a, 10)
      const nb = parseInt(b, 10)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      return a.localeCompare(b)
    })
  }, [stations])

  const filteredAndSortedStations = useMemo(() => {
    let filtered = stations

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
        (station.londonBorough && station.londonBorough.toLowerCase().includes(term)) ||
        (station.fareZone && station.fareZone.toLowerCase().includes(term)) ||
        (station.id && station.id.toLowerCase().includes(term))
      )
    }

    if (selectedTOC) filtered = filtered.filter(station => station.toc === selectedTOC)
    if (selectedCountry) filtered = filtered.filter(station => station.country === selectedCountry)
    if (selectedCounty) filtered = filtered.filter(station => station.county === selectedCounty)
    if (selectedLondonBorough) filtered = filtered.filter(station => station.londonBorough === selectedLondonBorough)
    if (selectedFareZone) filtered = filtered.filter(station => station.fareZone === selectedFareZone)

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
          const getLatestPassengers = (s: Station): number => {
            if (!s.yearlyPassengers || typeof s.yearlyPassengers !== 'object') return 0
            const years = Object.keys(s.yearlyPassengers)
              .filter(y => /^\d{4}$/.test(y))
              .sort((x, y) => parseInt(y) - parseInt(x))
            if (years.length === 0) return 0
            const latest = s.yearlyPassengers[years[0]]
            return typeof latest === 'number' ? latest : 0
          }
          const aP = getLatestPassengers(a)
          const bP = getLatestPassengers(b)
          return sortOption === 'passengers-asc' ? aP - bP : bP - aP
        }
        default:
          return 0
      }
    })

    return sorted
  }, [stations, debouncedSearchTerm, selectedTOC, selectedCountry, selectedCounty, selectedLondonBorough, selectedFareZone, sortOption])

  const totalPages = Math.ceil(filteredAndSortedStations.length / itemsPerPage)
  const paginatedStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredAndSortedStations.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredAndSortedStations, currentPage, itemsPerPage])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedTOC, selectedCountry, selectedCounty, selectedLondonBorough, selectedFareZone, sortOption])

  const handleStationClick = (station: Station) => {
    setSelectedStation(station)
    setIsModalOpen(true)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedTOC('')
    setSelectedCountry('')
    setSelectedCounty('')
    setSelectedLondonBorough('')
    setSelectedFareZone('')
    setSortOption('name-asc')
  }

  const activeFilterCount = [searchTerm, selectedTOC, selectedCountry, selectedCounty, selectedLondonBorough, selectedFareZone].filter(Boolean).length
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '0.5rem' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h3>Failed to Load Stations</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Station Database (Edit)</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
            Edit station fields and save changes to the database
          </p>
        </div>
      </header>

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

      <div className="search-section">
        <div className="search-container">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                scrollToResults()
              }
            }}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="controls-row">
          <button type="button" className="search-submit-button" onClick={scrollToResults} aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Search
          </button>
          <button className="filter-toggle-button" onClick={() => setShowFilters(!showFilters)} aria-label="Toggle filters">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters
            {hasActiveFilters && <span className="filter-badge">{activeFilterCount}</span>}
          </button>

          <div className="sort-container">
            <label htmlFor="sort-select-edit" className="sort-label">Sort by:</label>
            <select
              id="sort-select-edit"
              value={sortOption}
              onChange={e => setSortOption(e.target.value as SortOption)}
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

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group">
              <label htmlFor="toc-filter-edit" className="filter-label">TOC</label>
              <select id="toc-filter-edit" value={selectedTOC} onChange={e => setSelectedTOC(e.target.value)} className="filter-select">
                <option value="">All TOCs</option>
                {uniqueTOCs.map(toc => (
                  <option key={toc} value={toc}>{toc}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="country-filter-edit" className="filter-label">Country</label>
              <select id="country-filter-edit" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="filter-select">
                <option value="">All Countries</option>
                {uniqueCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="county-filter-edit" className="filter-label">County</label>
              <select id="county-filter-edit" value={selectedCounty} onChange={e => setSelectedCounty(e.target.value)} className="filter-select">
                <option value="">All Counties</option>
                {uniqueCounties.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="london-borough-filter-edit" className="filter-label">London Borough</label>
              <select id="london-borough-filter-edit" value={selectedLondonBorough} onChange={e => setSelectedLondonBorough(e.target.value)} className="filter-select">
                <option value="">All London Boroughs</option>
                {uniqueLondonBoroughs.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="fare-zone-filter-edit" className="filter-label">Fare Zone</label>
              <select id="fare-zone-filter-edit" value={selectedFareZone} onChange={e => setSelectedFareZone(e.target.value)} className="filter-select">
                <option value="">All Fare Zones</option>
                {uniqueFareZones.map(z => (
                  <option key={z} value={z}>{formatFareZoneDisplay(z) || z}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="results-count" ref={resultsSectionRef}>
          Showing {paginatedStations.length} of {filteredAndSortedStations.length} stations
          {filteredAndSortedStations.length !== stations.length && <span className="filtered-indicator"> (filtered)</span>}
        </div>
      </div>

      {filteredAndSortedStations.length === 0 && (debouncedSearchTerm || selectedTOC || selectedCountry || selectedCounty || selectedLondonBorough || selectedFareZone) && (
        <div className="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <h3>No Stations Found</h3>
          <p>Try adjusting your search terms or filters.</p>
          <button className="clear-filters-button" onClick={clearFilters}>Clear All Filters</button>
        </div>
      )}

      {paginatedStations.length > 0 && (
        <>
          <div className="stations-grid">
            {paginatedStations.map(s => (
              <div
                key={s.id}
                className="station-card"
                onClick={() => handleStationClick(s)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleStationClick(s)
                  }
                }}
                aria-label={`Edit ${s.stationName || 'Unknown Station'}`}
              >
                <div className="station-header">
                  <h3 className="station-name">{s.stationName || 'Unknown Station'}</h3>
                  {s.crsCode && <span className="station-crs">{s.crsCode}</span>}
                </div>
                <div className="station-details">
                  <div className="detail-item">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">
                      {formatStationLocationDisplay({
                        county: s.county,
                        country: s.country,
                        londonBorough: s.londonBorough
                      }) || 'N/A'}
                    </span>
                  </div>
                  {s.londonBorough && !isGreaterLondonCounty(s.county) && (
                    <div className="detail-item">
                      <span className="detail-label">London Borough</span>
                      <span className="detail-value">{s.londonBorough}</span>
                    </div>
                  )}
                  {s.fareZone && (
                    <div className="detail-item">
                      <span className="detail-label">Fare Zone</span>
                      <span className="detail-value">{formatFareZoneDisplay(s.fareZone) || s.fareZone}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">TOC</span>
                    <span className="detail-value">{s.toc || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Tiploc</span>
                    <span className="detail-value">{s.tiploc || 'N/A'}</span>
                  </div>
                </div>
                {s.yearlyPassengers && (
                  <div className="yearly-passengers">
                    <div className="detail-item">
                      <span className="detail-label">Latest Year Passengers</span>
                      <span className="detail-value">
                        {(() => {
                          if (typeof s.yearlyPassengers === 'object') {
                            const years = Object.keys(s.yearlyPassengers)
                              .filter(y => /^\d{4}$/.test(y))
                              .sort((a, b) => parseInt(b) - parseInt(a))
                            if (years.length > 0) {
                              const latest = s.yearlyPassengers[years[0]]
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
                  <span className="view-details-text">Click to edit</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <div className="pagination-info">Page {currentPage} of {totalPages}</div>
              <button
                className="pagination-button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}

      <StationEditModal
        station={selectedStation}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedStation(null)
        }}
        onSaved={refetch}
      />
    </div>
  )
}

export default StationDatabaseEdit
