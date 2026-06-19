import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStations } from '../../hooks/useStations'
import { useDebounce } from '../../hooks/useDebounce'
import {
  BUTLeftRoundedCircleButton,
  BUTRightRoundedCircleButton,
  BUTSquareButton,
  BUTTextNumberSquareButton,
  TOGToggleVisited,
  BUTWideButton,
} from '../../components/buttons'
import { PageTopHeader } from '../../components/misc'
import BUTDDMList from '../../components/buttons/ddm/BUTDDMList'
import BUTDDMListActionDual from '../../components/buttons/ddm/BUTDDMListActionDual'
import StationCard from '../../components/cards/StationCard/StationCard'
import StationAdminControls from '../../components/cards/StationAdminControls/StationAdminControls'
import NetworkStationTabGroup from '../../components/cards/NetworkStationTabGroup/NetworkStationTabGroup'
import { formatStationLocationDisplay } from '../../utils/formatStationLocation'
import { NETWORK_COLLECTION_IDS } from '../../constants/stationCollections'
import type { NetworkViewFilter } from '../../constants/stationCollections'
import { countPendingChangesForCollection } from '../../utils/pendingChangesByCollection'
import { useStationCollection } from '../../contexts/StationCollectionContext'
import { usePendingStationChanges } from '../../contexts/PendingStationChangesContext'
import { buildStationPath } from '../../utils/stationAreaSlug'
import { pathnameForReviewPendingSource } from '../../utils/reviewPendingNavigation'
import {
  filterStations,
  getDefaultStationFilterSelections,
  getStationFilterOptions,
  isOnlyGreaterLondonSelected,
  sortStations,
  type SortOption,
  type StationFilterSelections,
} from './stationSearchFiltering'
import './StationsPageRefactored.css'
import TXTINPBUTIconWideButtonSearch from '../../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'

interface StationsPageProps {
  initialMode?: 'view' | 'edit'
}

const SORT_DDM_OPTIONS: Array<{ label: string; value: SortOption }> = [
  { label: 'Name (A-Z)', value: 'name-asc' },
  { label: 'Name (Z-A)', value: 'name-desc' },
  { label: 'TOC (A-Z)', value: 'toc-asc' },
  { label: 'TOC (Z-A)', value: 'toc-desc' },
  { label: 'Passengers (Low-High)', value: 'passengers-asc' },
  { label: 'Passengers (High-Low)', value: 'passengers-desc' },
]

const StationsPage: React.FC<StationsPageProps> = ({ initialMode = 'view' }) => {
  const { stations: loadedStations, loading, error, refetch } = useStations()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSelections, setFilterSelections] = useState<StationFilterSelections>({
    tocs: [],
    countries: [],
    counties: [],
    boroughs: [],
    fareZones: [],
  })
  const [hasUserInteractedWithFilters, setHasUserInteractedWithFilters] = useState(false)
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [isEditMode, setIsEditMode] = useState<boolean>(initialMode === 'edit')
  const [isMobileFiltersExpanded, setIsMobileFiltersExpanded] = useState(false)
  const [isMobileSortExpanded, setIsMobileSortExpanded] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth
  )
  const { collectionId, networkView, setNetworkView, isSandbox, setSandbox } = useStationCollection()
  const { pendingChanges } = usePendingStationChanges()
  const pendingChangesCount = useMemo(() => {
    if (isSandbox) return countPendingChangesForCollection(pendingChanges, collectionId)
    if (networkView === 'all') {
      return NETWORK_COLLECTION_IDS.reduce(
        (sum, id) => sum + countPendingChangesForCollection(pendingChanges, id),
        0
      )
    }
    return countPendingChangesForCollection(pendingChanges, collectionId)
  }, [pendingChanges, collectionId, networkView, isSandbox])
  const isAdminPanelVisible =
    initialMode === 'edit' || new URLSearchParams(routerLocation.search).get('admin') === '1'

  useEffect(() => {
    const adminEnabled = new URLSearchParams(routerLocation.search).get('admin') === '1'
    if (adminEnabled || initialMode === 'edit') {
      setIsEditMode(true)
      return
    }
    if (initialMode !== 'edit') {
      setIsEditMode(false)
    }
  }, [routerLocation.search, initialMode])

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const stations = useMemo(() => {
    if (isSandbox || networkView === 'all') return loadedStations
    return loadedStations.filter((station) => station.sourceCollectionId === networkView)
  }, [loadedStations, isSandbox, networkView])

  const uniqueValues = useMemo(() => getStationFilterOptions(stations || []), [stations])
  const defaultSelections = useMemo(
    () => getDefaultStationFilterSelections(uniqueValues),
    [uniqueValues]
  )
  const effectiveSelections = hasUserInteractedWithFilters ? filterSelections : defaultSelections

  const filteredStations = useMemo(
    () => filterStations(stations || [], debouncedSearchTerm, effectiveSelections, uniqueValues),
    [stations, debouncedSearchTerm, effectiveSelections, uniqueValues]
  )

  const sortedStations = useMemo(() => sortStations(filteredStations, sortOption), [filteredStations, sortOption])

  const ITEMS_PER_PAGE = 20
  const totalPages = Math.ceil(sortedStations.length / ITEMS_PER_PAGE)
  const paginatedStations = sortedStations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )
  const visiblePaginationItems = useMemo(() => {
    const windowSize = viewportWidth < 640 ? 3 : viewportWidth < 1024 ? 5 : 7
    const trailingPagesCount = 3

    if (totalPages <= windowSize + trailingPagesCount) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const halfWindow = Math.floor(windowSize / 2)
    let start = Math.max(1, currentPage - halfWindow)
    let end = Math.min(totalPages, start + windowSize - 1)

    if (end - start + 1 < windowSize) {
      start = Math.max(1, end - windowSize + 1)
    }

    const currentWindow = Array.from({ length: end - start + 1 }, (_, index) => start + index)
    const lastPagesStart = Math.max(1, totalPages - trailingPagesCount + 1)
    const lastThreePages = Array.from(
      { length: totalPages - lastPagesStart + 1 },
      (_, index) => lastPagesStart + index
    )
    const mergedPages = Array.from(new Set([...currentWindow, ...lastThreePages])).sort((a, b) => a - b)

    const items: Array<number | 'ellipsis'> = []
    mergedPages.forEach((page, index) => {
      const prev = mergedPages[index - 1]
      if (typeof prev === 'number' && page - prev > 1) {
        items.push('ellipsis')
      }
      items.push(page)
    })

    return items
  }, [currentPage, totalPages, viewportWidth])

  const updateFilterSelection = useCallback(
    (key: keyof StationFilterSelections, selectedItems: string[]) => {
      setFilterSelections((prev) => {
        const baseSelections = hasUserInteractedWithFilters ? prev : defaultSelections
        const next = { ...baseSelections, [key]: selectedItems }
        if (key === 'counties') {
          if (isOnlyGreaterLondonSelected(selectedItems)) {
            next.boroughs = uniqueValues.boroughs
          } else {
            next.boroughs = []
          }
        }
        return next
      })
      setHasUserInteractedWithFilters(true)
    },
    [defaultSelections, hasUserInteractedWithFilters, uniqueValues.boroughs]
  )

  const getSelectedPositions = (items: string[], selectedItems: string[]) =>
    selectedItems
      .map((item) => items.indexOf(item))
      .filter((index) => index >= 0)

  const boroughFilterEnabled = isOnlyGreaterLondonSelected(effectiveSelections.counties)

  const toggleLondonBoroughFilter = useCallback(() => {
    if (boroughFilterEnabled) {
      updateFilterSelection('counties', defaultSelections.counties)
      return
    }
    updateFilterSelection('counties', ['Greater London'])
  }, [defaultSelections.counties, boroughFilterEnabled, updateFilterSelection])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, effectiveSelections, sortOption, collectionId, networkView])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


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
      <PageTopHeader
        title="Station Database"
        subtitle={
          isEditMode
            ? 'View or edit station fields and prepare changes for publishing'
            : 'Explore railway stations and passenger data'
        }
      />
      <div
        className={[
          'stations-toolbar-band',
          !isAdminPanelVisible && !isSandbox ? 'stations-toolbar-band--desktop-only' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isAdminPanelVisible && (
          <div className="stations-admin-controls-wrap">
            <StationAdminControls
              isEditMode={isEditMode}
              isSandbox={isSandbox}
              pendingChangesCount={pendingChangesCount}
              onModeChange={(mode) => setIsEditMode(mode === 'edit')}
              onSandboxChange={setSandbox}
              onOpenPendingChanges={() =>
                navigate('/stations/pending-review', {
                  state: { from: pathnameForReviewPendingSource(routerLocation) }
                })
              }
              onAddStation={() => navigate('/stations/new')}
            />
          </div>
        )}
        {!isSandbox && (
          <div className="stations-network-tabs-wrap stations-network-tabs-wrap--toolbar">
            <NetworkStationTabGroup
              value={networkView}
              onChange={(view: NetworkViewFilter) => setNetworkView(view)}
            />
          </div>
        )}
        {isSandbox && (
          <p className="stations-sandbox-banner" role="status">
            Sandbox mode — viewing test data in newsandboxstations1
          </p>
        )}
      </div>

      {/* Main Content */}
      <div className="stations-content">
        {/* Sidebar */}
        <aside className="stations-sidebar">
          {/* Search + Filters + Sort */}
          <div className="sidebar-section">
            {isAdminPanelVisible && isEditMode && (
              <div className="stations-sidebar-add-station stations-sidebar-add-station--desktop">
                <BUTWideButton
                  type="button"
                  width="fill"
                  onClick={() => navigate('/stations/new')}
                >
                  + Add new station
                </BUTWideButton>
              </div>
            )}
            <h2 className="sidebar-section-title sidebar-section-title--subsection">Search</h2>
            <div className="search-container">
              <TXTINPBUTIconWideButtonSearch
                id="stations-search"
                name="station-search"
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="7" cy="7" r="4" />
                    <line x1="11" y1="11" x2="13" y2="13" />
                  </svg>
                }
                value={searchTerm}
                onChange={setSearchTerm}
                onClear={() => setSearchTerm('')}
                className="search-input-shell"
                placeholder="Search stations..."
                autoComplete="off"
                colorVariant="primary"
                showClear
              />
            </div>
            <div className="search-filters-spacer" aria-hidden="true" />
            <h2 className="sidebar-section-title sidebar-section-title--subsection stations-mobile-filters-heading">
              Filters
            </h2>
            <div className="mobile-filters-toggle-row">
              <BUTWideButton
                type="button"
                width="fill"
                className="mobile-filters-toggle"
                onClick={() => setIsMobileFiltersExpanded((prev) => !prev)}
                aria-expanded={isMobileFiltersExpanded}
                aria-controls="stations-mobile-only-filters"
              >
                {isMobileFiltersExpanded ? 'Hide Filters' : 'Show Filters'}
              </BUTWideButton>
              <BUTWideButton
                type="button"
                width="fill"
                className="mobile-filters-toggle"
                onClick={() => setIsMobileSortExpanded((prev) => !prev)}
                aria-expanded={isMobileSortExpanded}
                aria-controls="stations-mobile-only-sort"
              >
                {isMobileSortExpanded ? 'Hide Sort' : 'Show Sort'}
              </BUTWideButton>
            </div>
            {!isSandbox && (
              <div className="stations-network-tabs-wrap stations-network-tabs-wrap--mobile">
                <h2 className="sidebar-section-title sidebar-section-title--subsection">Network</h2>
                <NetworkStationTabGroup
                  value={networkView}
                  onChange={(view: NetworkViewFilter) => setNetworkView(view)}
                />
              </div>
            )}

            <div
              id="stations-mobile-only-filters"
              className={`mobile-filters-content mobile-filters-content--filters ${isMobileFiltersExpanded ? 'mobile-filters-content--expanded' : ''}`}
            >
              <div className="mobile-filters-content-inner">
                <h2 className="sidebar-section-title sidebar-section-title--subsection">Filters</h2>
                <div className="filters-grid">
                  <div className="filter-group">
                    <label className="filter-label">TOC</label>
                    <BUTDDMListActionDual
                      items={uniqueValues.tocs}
                      filterName="TOCs"
                      selectionMode="multi"
                      selectedPositions={getSelectedPositions(uniqueValues.tocs, effectiveSelections.tocs)}
                      onSelectionChanged={(_, selectedItems) => updateFilterSelection('tocs', selectedItems)}
                      colorVariant="primary"
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">Country</label>
                    <BUTDDMListActionDual
                      items={uniqueValues.countries}
                      filterName="Countries"
                      selectionMode="multi"
                      selectedPositions={getSelectedPositions(uniqueValues.countries, effectiveSelections.countries)}
                      onSelectionChanged={(_, selectedItems) => updateFilterSelection('countries', selectedItems)}
                      colorVariant="primary"
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">County</label>
                    <BUTDDMListActionDual
                      items={uniqueValues.counties}
                      filterName="Counties"
                      selectionMode="multi"
                      selectedPositions={getSelectedPositions(uniqueValues.counties, effectiveSelections.counties)}
                      onSelectionChanged={(_, selectedItems) => updateFilterSelection('counties', selectedItems)}
                      colorVariant="primary"
                    />
                    <div className="county-london-toggle">
                      <span className="county-london-toggle__label">London Borough Filter</span>
                      <TOGToggleVisited
                        checked={boroughFilterEnabled}
                        onChange={() => toggleLondonBoroughFilter()}
                        ariaLabel="London Borough Filter"
                        className="county-london-toggle__control"
                      />
                    </div>
                  </div>

                  {boroughFilterEnabled && (
                    <div className="filter-group">
                      <label className="filter-label">Borough</label>
                      <BUTDDMListActionDual
                        items={uniqueValues.boroughs}
                        filterName="Boroughs"
                        selectionMode="multi"
                        selectedPositions={getSelectedPositions(uniqueValues.boroughs, effectiveSelections.boroughs)}
                        onSelectionChanged={(_, selectedItems) => updateFilterSelection('boroughs', selectedItems)}
                        colorVariant="primary"
                      />
                    </div>
                  )}

                  <div className="filter-group">
                    <label className="filter-label">Fare Zone</label>
                    <BUTDDMListActionDual
                      items={uniqueValues.fareZones}
                      filterName="Fare Zones"
                      selectionMode="multi"
                      selectedPositions={getSelectedPositions(uniqueValues.fareZones, effectiveSelections.fareZones)}
                      onSelectionChanged={(_, selectedItems) => updateFilterSelection('fareZones', selectedItems)}
                      colorVariant="primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              id="stations-mobile-only-sort"
              className={`mobile-filters-content mobile-filters-content--sort ${isMobileSortExpanded ? 'mobile-filters-content--expanded' : ''}`}
            >
              <div className="mobile-filters-content-inner">
                <h2 className="sidebar-section-title sidebar-section-title--subsection">Sort</h2>
                <div className="sort-section">
                  <BUTDDMList
                    items={SORT_DDM_OPTIONS.map((option) => option.label)}
                    filterName="Sort"
                    selectionMode="single"
                    selectedPositions={[Math.max(0, SORT_DDM_OPTIONS.findIndex((option) => option.value === sortOption))]}
                    onSelectionChanged={(selectedPositions) => {
                      const selectedIndex = selectedPositions[0]
                      if (typeof selectedIndex !== 'number') return
                      const selectedSortOption = SORT_DDM_OPTIONS[selectedIndex]
                      if (selectedSortOption) {
                        setSortOption(selectedSortOption.value)
                      }
                    }}
                    colorVariant="primary"
                  />
                </div>
              </div>
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
                onCardClick={() => navigate(`/stations/${buildStationPath(station, collectionId)}${isEditMode ? '/edit' : ''}`)}
                onInfoClick={() => navigate(`/stations/${buildStationPath(station, collectionId)}${isEditMode ? '/edit' : ''}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="stations-pagination">
              <div className="pagination-control-row">
                <BUTLeftRoundedCircleButton
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  ariaLabel="Previous page"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  }
                />
                <div className="pagination-page-buttons">
                  {visiblePaginationItems.map((item, index) => (
                    item === 'ellipsis' ? (
                      <BUTSquareButton
                        key={`ellipsis-${index}`}
                        type="button"
                        ariaLabel="More pages"
                      >
                        ...
                      </BUTSquareButton>
                    ) : (
                      <BUTTextNumberSquareButton
                        key={item}
                        type="button"
                        text={String(item)}
                        pressed={item === currentPage}
                        onClick={() => setCurrentPage(item)}
                        ariaLabel={`Go to page ${item}`}
                      />
                    )
                  ))}
                </div>
                <BUTRightRoundedCircleButton
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  ariaLabel="Next page"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  }
                />
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  )
}

export default StationsPage
