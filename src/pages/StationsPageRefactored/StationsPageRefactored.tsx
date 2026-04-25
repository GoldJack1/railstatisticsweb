import React, { useState, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStations } from '../../hooks/useStations'
import { useDebounce } from '../../hooks/useDebounce'
import type { Station } from '../../types'
import { BUTWideButton } from '../../components/buttons'
import { BUTCircleButton } from '../../components/buttons'
import StationCard from '../../components/cards/StationCard/StationCard'
import StationAdminControls from '../../components/cards/StationAdminControls/StationAdminControls'
import { formatStationLocationDisplay } from '../../utils/formatStationLocation'
import { useStationCollection } from '../../contexts/StationCollectionContext'
import { usePendingStationChanges } from '../../contexts/PendingStationChangesContext'
import { pathnameForReviewPendingSource } from '../../utils/reviewPendingNavigation'
import './StationsPageRefactored.css'
import TXTINPIconWideButtonSearch from '../../components/textInputs/special/TXTINPIconWideButtonSearch'

interface StationsPageProps {
  initialMode?: 'view' | 'edit'
}

type SortOption = 'name-asc' | 'name-desc' | 'passengers-asc' | 'passengers-desc' | 'toc-asc' | 'toc-desc'

const StationsPage: React.FC<StationsPageProps> = ({ initialMode = 'view' }) => {
  const { stations, loading, error, refetch } = useStations()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTOC, setSelectedTOC] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCounty, setSelectedCounty] = useState<string>('')
  const [selectedLondonBorough, setSelectedLondonBorough] = useState<string>('')
  const [selectedFareZone, setSelectedFareZone] = useState<string>('')
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [isEditMode, setIsEditMode] = useState<boolean>(initialMode === 'edit')
  const { collectionId, setCollectionId } = useStationCollection()
  const { pendingChanges } = usePendingStationChanges()


  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const filteredStations = useMemo(() => {
    if (!stations) return []

    return stations.filter(station => {
      const searchTermMatch = !debouncedSearchTerm || 
        (station.stationName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
         station.crsCode?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
         station.toc?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
         station.county?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))

      const tocMatch = !selectedTOC || station.toc === selectedTOC
      const countryMatch = !selectedCountry || station.country === selectedCountry
      const countyMatch = !selectedCounty || station.county === selectedCounty
      const londonBoroughMatch = !selectedLondonBorough || station.londonBorough === selectedLondonBorough
      const fareZoneMatch = !selectedFareZone || station.fareZone === selectedFareZone

      return searchTermMatch && tocMatch && countryMatch && countyMatch && londonBoroughMatch && fareZoneMatch
    })
  }, [stations, debouncedSearchTerm, selectedTOC, selectedCountry, selectedCounty, selectedLondonBorough, selectedFareZone])

  const sortedStations = useMemo(() => {
    const sorted = [...filteredStations].sort((a, b) => {
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
            if (station.yearlyPassengers && typeof station.yearlyPassengers === 'object') {
              const years = Object.keys(station.yearlyPassengers)
                .filter(y => /^\d{4}$/.test(y))
                .sort((a, b) => parseInt(b) - parseInt(a))
              if (years.length > 0) {
                const latest = station.yearlyPassengers[years[0]]
                return typeof latest === 'number' ? latest : 0
              }
            }
            return 0
          }
          const aPassengers = getLatestPassengers(a)
          const bPassengers = getLatestPassengers(b)
          return sortOption === 'passengers-asc' ? aPassengers - bPassengers : bPassengers - aPassengers
        }
        default:
          return 0
      }
    })
    return sorted
  }, [filteredStations, sortOption])

  const ITEMS_PER_PAGE = 20
  const totalPages = Math.ceil(sortedStations.length / ITEMS_PER_PAGE)
  const paginatedStations = sortedStations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const hasActiveFilters = debouncedSearchTerm || selectedTOC || selectedCountry || selectedCounty || selectedLondonBorough || selectedFareZone

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setSelectedTOC('')
    setSelectedCountry('')
    setSelectedCounty('')
    setSelectedLondonBorough('')
    setSelectedFareZone('')
    setCurrentPage(1)
  }, [])

  const uniqueValues = useMemo(() => {
    if (!stations) return { tocs: [], countries: [], counties: [], londonBoroughs: [], fareZones: [] }

    const tocs = [...new Set(stations.map(s => s.toc).filter(Boolean))]
    const countries = [...new Set(stations.map(s => s.country).filter(Boolean))]
    const counties = [...new Set(stations.map(s => s.county).filter(Boolean))]
    const londonBoroughs = [...new Set(stations.map(s => s.londonBorough).filter(Boolean))]
    const fareZones = [...new Set(stations.map(s => s.fareZone).filter(Boolean))]

    return { tocs, countries, counties, londonBoroughs, fareZones }
  }, [stations])


  if (loading) {
    return (
      <div className="stations-page">
        <div className="stations-loading">
          <div className="loading-spinner"></div>
          <p>Loading data from Cloud Database...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stations-page">
        <div className="stations-error">
          <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h2>Failed to load stations</h2>
          <p>{error}</p>
          <BUTWideButton onClick={() => refetch()} width="hug">
            Try Again
          </BUTWideButton>
        </div>
      </div>
    )
  }

  return (
    <div className="stations-page">
      {/* Header */}
      <header className="stations-header">
        <div className="stations-header-content">
          <div className="stations-header-copy">
            <h1 className="stations-title">Station Database</h1>
            <p className="stations-subtitle">
              {isEditMode
                ? 'View or edit station fields and prepare changes for publishing'
                : 'Explore railway stations and passenger data'}
            </p>
          </div>
        </div>
      </header>
      <div className="stations-admin-controls-wrap">
        <StationAdminControls
          isEditMode={isEditMode}
          collectionId={collectionId}
          pendingChangesCount={Object.keys(pendingChanges).length}
          onModeChange={(mode) => setIsEditMode(mode === 'edit')}
          onCollectionChange={setCollectionId}
          onOpenPendingChanges={() =>
            navigate('/stations/pending-review', {
              state: { from: pathnameForReviewPendingSource(routerLocation) }
            })
          }
        />
      </div>

      {/* Main Content */}
      <div className="stations-content">
        {/* Sidebar */}
        <aside className="stations-sidebar">
          {/* Search */}
          <div className="sidebar-section">
            <h2 className="sidebar-section-title">Search</h2>
            <div className="search-container">
              <TXTINPIconWideButtonSearch
                id="stations-search"
                name="station-search"
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="7" cy="7" r="4" />
                    <line x1="11" y1="11" x2="13" y2="13" />
                  </svg>
                }
                value={searchTerm}
                onInputChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-shell"
                placeholder="Search stations..."
                autoComplete="off"
                colorVariant="secondary"
                showClear={false}
              />
              {hasActiveFilters && (
                <BUTCircleButton
                  type="button"
                  className="clear-search-button"
                  ariaLabel="Clear all filters"
                  onClick={clearFilters}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  }
                />
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="sidebar-section">
            <h2 className="sidebar-section-title">Filters</h2>
            <div className="filters-grid">
              <div className="filter-group">
                <label className="filter-label">TOC</label>
                <select
                  value={selectedTOC}
                  onChange={(e) => setSelectedTOC(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All</option>
                  {uniqueValues.tocs.map(toc => (
                    <option value={toc || ''}>{toc || 'Unknown'}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Country</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All</option>
                  {uniqueValues.countries.map(country => (
                    <option value={country || ''}>{country || 'Unknown'}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">County</label>
                <select
                  value={selectedCounty}
                  onChange={(e) => setSelectedCounty(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All</option>
                  {uniqueValues.counties.map(county => (
                    <option value={county || ''}>{county || 'Unknown'}</option>
                  ))}
                </select>
              </div>

              {selectedCounty === 'Greater London' && (
                <div className="filter-group">
                  <label className="filter-label">London Borough</label>
                  <select
                    value={selectedLondonBorough}
                    onChange={(e) => setSelectedLondonBorough(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All</option>
                    {uniqueValues.londonBoroughs.map(borough => (
                      <option key={borough} value={borough || ''}>{borough || 'Unknown'}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="filter-group">
                <label className="filter-label">Fare Zone</label>
                <select
                  value={selectedFareZone}
                  onChange={(e) => setSelectedFareZone(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All</option>
                  {uniqueValues.fareZones.map(zone => (
                    <option value={zone || ''}>{zone || 'Unknown'}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sort */}
          <div className="sidebar-section">
            <h2 className="sidebar-section-title">Sort</h2>
            <div className="sort-section">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="sort-select"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="toc-asc">TOC (A-Z)</option>
                <option value="toc-desc">TOC (Z-A)</option>
                <option value="passengers-asc">Passengers (Low-High)</option>
                <option value="passengers-desc">Passengers (High-Low)</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="stations-main">
          {/* Station Grid */}
          <div className="stations-page-grid">
            {paginatedStations.map(station => (
              <StationCard
                key={station.id}
                station={station}
                locationDisplay={formatStationLocationDisplay(station)}
                onCardClick={() => navigate(`/stations/${station.id}${isEditMode ? '/edit' : ''}`)}
                onInfoClick={() => navigate(`/stations/${station.id}${isEditMode ? '/edit' : ''}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="stations-pagination">
              <div className="pagination-controls">
                <BUTWideButton
                  type="button"
                  width="hug"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                  }
                >
                  Previous
                </BUTWideButton>
              </div>
              
              <div className="pagination-info">
                Page {currentPage} of {totalPages}
              </div>
              
              <div className="pagination-controls">
                <BUTWideButton
                  type="button"
                  width="hug"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  }
                >
                  Next
                </BUTWideButton>
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  )
}

export default StationsPage
