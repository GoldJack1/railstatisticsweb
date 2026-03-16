import React, { useState, useMemo, useRef, useCallback } from 'react'
import { useStations } from '../hooks/useStations'
import { useDebounce } from '../hooks/useDebounce'
import StationModal from './StationModal'
import StationEditModal from './StationEditModal'
import type { Station } from '../types'
import { formatFareZoneDisplay } from '../utils/formatFareZone'
import { formatStationLocationDisplay, isGreaterLondonCounty } from '../utils/formatStationLocation'
import { useStationCollection } from '../contexts/StationCollectionContext'
import type { StationCollectionId } from '../services/firebase'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import { updateStationInFirebase } from '../services/firebase'
import './Stations.css'

type SortOption = 'name-asc' | 'name-desc' | 'passengers-asc' | 'passengers-desc' | 'toc-asc' | 'toc-desc'

interface StationsProps {
  initialMode?: 'view' | 'edit'
}

const Stations: React.FC<StationsProps> = ({ initialMode = 'view' }) => {
  const { stations, loading, error, refetch } = useStations()
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
  const [isEditMode, setIsEditMode] = useState<boolean>(initialMode === 'edit')
  const resultsSectionRef = useRef<HTMLDivElement>(null)
  const { collectionId, setCollectionId } = useStationCollection()
  const { pendingChanges, clearAllPendingChanges } = usePendingStationChanges()
  const [isPublishingAll, setIsPublishingAll] = useState(false)
  const [showPendingReview, setShowPendingReview] = useState(false)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const scrollToResults = useCallback(() => {
    resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
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
        (station.londonBorough && station.londonBorough.toLowerCase().includes(term)) ||
        (station.fareZone && station.fareZone.toLowerCase().includes(term)) ||
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

    // Filter by London Borough
    if (selectedLondonBorough) {
      filtered = filtered.filter(station => station.londonBorough === selectedLondonBorough)
    }

    // Filter by Fare Zone
    if (selectedFareZone) {
      filtered = filtered.filter(station => station.fareZone === selectedFareZone)
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
  }, [stations, debouncedSearchTerm, selectedTOC, selectedCountry, selectedCounty, selectedLondonBorough, selectedFareZone, sortOption])

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

  // Count active data filters (excludes UI state like showFilters)
  const activeFilterCount = [searchTerm, selectedTOC, selectedCountry, selectedCounty, selectedLondonBorough, selectedFareZone].filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0

  const pendingCount = Object.keys(pendingChanges).length

  const handlePublishAll = async () => {
    if (pendingCount === 0) return
    if (!window.confirm(`Are you sure you want to publish ${pendingCount} pending change${pendingCount > 1 ? 's' : ''} to the database?`)) {
      return
    }

    setIsPublishingAll(true)
    try {
      for (const [stationId, entry] of Object.entries(pendingChanges)) {
        await updateStationInFirebase(stationId, entry.updated)
      }
      clearAllPendingChanges()
      await refetch()
      setShowPendingReview(false)
    } finally {
      setIsPublishingAll(false)
    }
  }

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
      <div className="stations-layout">
        <aside className="stations-sidebar">
          <header className="page-header">
            <div>
              <h1 className="page-title">Station Database</h1>
              <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
                {isEditMode
                  ? 'View or edit station fields and prepare changes for publishing'
                  : 'Explore railway stations and passenger data'}
              </p>
            </div>
          </header>

          {/* Database mode + data source + pending changes */}
          <section className="sidebar-card">
            <div className="station-controls-strip">
              <div className="station-controls-left">
                <div>
                  <span className="sort-label" style={{ marginRight: '0.5rem' }}>
                    Mode:
                  </span>
                  <div className="mode-toggle" role="group" aria-label="Mode">
                    <button
                      type="button"
                      className={`mode-toggle-button ${!isEditMode ? 'mode-toggle-button--active' : ''}`}
                      onClick={() => setIsEditMode(false)}
                      aria-pressed={!isEditMode}
                    >
                      View only
                    </button>
                    <button
                      type="button"
                      className={`mode-toggle-button ${isEditMode ? 'mode-toggle-button--active' : ''}`}
                      onClick={() => setIsEditMode(true)}
                      aria-pressed={isEditMode}
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="station-collection-select" className="sort-label" style={{ marginRight: '0.5rem' }}>
                    Data source:
                  </label>
                  <select
                    id="station-collection-select"
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value as StationCollectionId)}
                    className="sort-select"
                  >
                    <option value="stations2603">Production (stations2603)</option>
                    <option value="newsandboxstations1">Sandbox (newsandboxstations1)</option>
                  </select>
                </div>
              </div>
            </div>

            {pendingCount > 0 && (
              <div className="sidebar-pending-summary">
                <button
                  type="button"
                  className="pending-changes-button"
                  onClick={() => setShowPendingReview(prev => !prev)}
                >
                  {pendingCount} pending change{pendingCount > 1 ? 's' : ''} ·{' '}
                  {showPendingReview ? 'Hide review' : 'Review changes'}
                </button>
              </div>
            )}

            {pendingCount > 0 && showPendingReview && (
              <section className="pending-review-section" aria-label="Review pending station changes before publishing">
              <h2 className="pending-review-title">Review pending changes</h2>
              <p className="pending-review-subtitle">
                These edits are staged locally and will be written to the selected data source when you publish.
              </p>

              <div className="pending-review-list">
                {Object.entries(pendingChanges).map(([stationId, entry]) => {
                  const { original, updated } = entry

                  const formatValue = (value: unknown): string => {
                    if (value === null || value === undefined || value === '') return '—'
                    return String(value)
                  }

                  const changes: Array<{ label: string; from: string; to: string }> = []
                  const addChange = (label: string, fromValue: unknown, toValue: unknown) => {
                    const fromStr = formatValue(fromValue)
                    const toStr = formatValue(toValue)
                    if (fromStr !== toStr) {
                      changes.push({ label, from: fromStr, to: toStr })
                    }
                  }

                  addChange('Station name', original.stationName ?? '', updated.stationName ?? original.stationName ?? '')
                  addChange('CRS code', original.crsCode ?? '', updated.crsCode ?? original.crsCode ?? '')
                  addChange('Tiploc', original.tiploc ?? '', updated.tiploc ?? original.tiploc ?? '')
                  addChange('TOC', original.toc ?? '', updated.toc ?? original.toc ?? '')
                  addChange('Country', original.country ?? '', updated.country ?? original.country ?? '')
                  addChange('County', original.county ?? '', updated.county ?? original.county ?? '')
                  addChange('Station area', original.stnarea ?? '', updated.stnarea ?? original.stnarea ?? '')
                  addChange('London Borough', original.londonBorough ?? '', updated.londonBorough ?? original.londonBorough ?? '')
                  addChange('Fare Zone', original.fareZone ?? '', updated.fareZone ?? original.fareZone ?? '')
                  addChange('Latitude', original.latitude ?? '', updated.latitude ?? original.latitude ?? '')
                  addChange('Longitude', original.longitude ?? '', updated.longitude ?? original.longitude ?? '')

                  const originalPassengers =
                    original.yearlyPassengers && typeof original.yearlyPassengers === 'object' && !Array.isArray(original.yearlyPassengers)
                      ? JSON.stringify(original.yearlyPassengers)
                      : ''
                  const updatedPassengers =
                    updated.yearlyPassengers && typeof updated.yearlyPassengers === 'object'
                      ? JSON.stringify(updated.yearlyPassengers)
                      : originalPassengers

                  if (originalPassengers !== updatedPassengers) {
                    changes.push({
                      label: 'Yearly passengers',
                      from: originalPassengers || '—',
                      to: updatedPassengers || '—'
                    })
                  }

                  return (
                    <article key={stationId} className="pending-review-item">
                      <header className="pending-review-item-header">
                        <div>
                          <div className="pending-review-station-name">
                            {original.stationName || 'Untitled station'}
                          </div>
                          <div className="pending-review-station-meta">
                            <span>{original.crsCode || 'No CRS'}</span>
                            <span>·</span>
                            <span>ID: {stationId}</span>
                          </div>
                        </div>
                      </header>

                      {changes.length === 0 ? (
                        <p className="pending-review-no-changes">
                          No field-level differences detected for this station.
                        </p>
                      ) : (
                        <ul className="pending-review-change-list">
                          {changes.map(change => (
                            <li key={change.label} className="pending-review-change">
                              <div className="pending-review-change-label">{change.label}</div>
                              <div className="pending-review-change-values">
                                <span className="pending-review-change-from">{change.from}</span>
                                <span className="pending-review-change-arrow">→</span>
                                <span className="pending-review-change-to">{change.to}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>

              <div className="pending-review-actions">
                <button
                  type="button"
                  className="pending-review-cancel"
                  onClick={() => setShowPendingReview(false)}
                  disabled={isPublishingAll}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="pending-review-publish"
                  onClick={handlePublishAll}
                  disabled={isPublishingAll}
                >
                  {isPublishingAll ? 'Publishing…' : 'Publish all changes'}
                </button>
              </div>
            </section>
            )}
          </section>

          {/* Search section */}
          <section className="sidebar-card">
            <div className="search-container">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    scrollToResults()
                  }
                }}
                className="search-input"
                placeholder="Search by station name, code, TOC, or location"
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
          </section>

          {/* Filters section */}
          <section className="sidebar-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Filters</span>
              {hasActiveFilters && <span className="filter-badge">{activeFilterCount}</span>}
            </div>

            <div className="filters-panel filters-panel-inline">
                <div className="filter-group">
                  <label htmlFor="toc-filter" className="filter-label">
                    TOC
                  </label>
                  <select
                    id="toc-filter"
                    value={selectedTOC}
                    onChange={(e) => setSelectedTOC(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All TOCs</option>
                    {uniqueTOCs.map(toc => (
                      <option key={toc} value={toc}>
                        {toc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="country-filter" className="filter-label">
                    Country
                  </label>
                  <select
                    id="country-filter"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Countries</option>
                    {uniqueCountries.map(country => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="county-filter" className="filter-label">
                    County
                  </label>
                  <select
                    id="county-filter"
                    value={selectedCounty}
                    onChange={(e) => setSelectedCounty(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Counties</option>
                    {uniqueCounties.map(county => (
                      <option key={county} value={county}>
                        {county}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="london-borough-filter" className="filter-label">
                    London Borough
                  </label>
                  <select
                    id="london-borough-filter"
                    value={selectedLondonBorough}
                    onChange={(e) => setSelectedLondonBorough(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All London Boroughs</option>
                    {uniqueLondonBoroughs.map(borough => (
                      <option key={borough} value={borough}>
                        {borough}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="fare-zone-filter" className="filter-label">
                    Fare Zone
                  </label>
                  <select
                    id="fare-zone-filter"
                    value={selectedFareZone}
                    onChange={(e) => setSelectedFareZone(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Fare Zones</option>
                    {uniqueFareZones.map(zone => (
                      <option key={zone} value={zone}>
                        {formatFareZoneDisplay(zone) || zone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            
          </section>

          {/* Sort / results section */}
          <section className="sidebar-card">
            <div className="sort-container">
              <label htmlFor="sort-select" className="sort-label">
                Sort
              </label>
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

            <div className="results-count" ref={resultsSectionRef}>
              Showing {paginatedStations.length} of {filteredAndSortedStations.length} stations
              {filteredAndSortedStations.length !== stations.length && (
                <span className="filtered-indicator"> (filtered)</span>
              )}
            </div>
          </section>
        </aside>

        <main className="stations-main">
          {/* No Results State */}
      {filteredAndSortedStations.length === 0 && (debouncedSearchTerm || selectedTOC || selectedCountry || selectedCounty || selectedLondonBorough || selectedFareZone) && (
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
                aria-label={`${isEditMode ? 'Edit' : 'View details for'} ${station.stationName || 'Unknown Station'}`}
              >
                <div className="station-header">
                  <div>
                    <h3 className="station-name">{station.stationName || 'Unknown Station'}</h3>
                    <div className="station-subtitle">
                      <span>
                        {formatStationLocationDisplay({
                          county: station.county,
                          country: station.country,
                          londonBorough: station.londonBorough
                        }) || 'Location unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="station-header-right">
                    {station.crsCode && <span className="station-chip station-chip-primary">{station.crsCode}</span>}
                    {station.tiploc && <span className="station-chip">{station.tiploc}</span>}
                    {pendingChanges[station.id] && (
                      <span className="station-chip station-chip-muted" aria-label="This station has unpublished edits">
                        Edited
                      </span>
                    )}
                  </div>
                </div>

                <div className="station-details station-details-two-column">
                  <div className="detail-item">
                    <span className="detail-label">TOC</span>
                    <span className="detail-value">{station.toc || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Fare zone</span>
                    <span className="detail-value">
                      {station.fareZone ? (formatFareZoneDisplay(station.fareZone) || station.fareZone) : 'N/A'}
                    </span>
                  </div>
                  {station.londonBorough && !isGreaterLondonCounty(station.county) && (
                    <div className="detail-item detail-item-full">
                      <span className="detail-label">London borough</span>
                      <span className="detail-value">{station.londonBorough}</span>
                    </div>
                  )}
                </div>

                <div className="station-meta-line">
                  <span>
                    Latest passengers:{' '}
                    {(() => {
                      if (station.yearlyPassengers && typeof station.yearlyPassengers === 'object') {
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
                  <span className="station-meta-separator">·</span>
                  <span>ID: {station.id}</span>
                </div>

                <div className="station-card-footer">
                  <span className="view-details-text">
                    {isEditMode ? 'Click to edit' : 'Click to view full details'}
                  </span>
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
      
      {isEditMode ? (
        <StationEditModal
          station={selectedStation}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedStation(null)
          }}
        />
      ) : (
        <StationModal 
          station={selectedStation}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedStation(null)
          }}
        />
      )}
        </main>
      </div>
    </div>
  )
}

export default Stations
