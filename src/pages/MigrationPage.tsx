import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
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
import type {
  MigrationState,
  ColumnMapping,
  FirebaseStationLike,
  NewFormatStation,
  StationMatch,
  MigrationCorrectionLogEntry
} from '../types/migration'
import Button from '../components/Button'
import '../components/Migration.css'
import { formatStationLocationDisplay, isGreaterLondonCounty } from '../utils/formatStationLocation'

/** Step 2 — grouped column mapping (order + labels shown in UI) */
const COLUMN_MAPPING_SECTIONS: {
  title: string
  description: string
  fields: { key: keyof ColumnMapping; label: string; hint?: string; required?: boolean }[]
}[] = [
  {
    title: 'Station & operator',
    description: 'Columns that identify the station and train operator.',
    fields: [
      { key: 'stationName', label: 'Station name', required: true },
      { key: 'country', label: 'Country' },
      { key: 'county', label: 'County / region' },
      { key: 'operator', label: 'Operator (TOC)' }
    ]
  },
  {
    title: 'Visits & preferences',
    description: 'Optional columns for visit history and favourites.',
    fields: [
      { key: 'visited', label: 'Visited (yes/no)' },
      { key: 'visitDate', label: 'Visit date' },
      { key: 'favorite', label: 'Favourite' }
    ]
  },
  {
    title: 'Location',
    description: 'Coordinates or a single JSON location column.',
    fields: [
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      {
        key: 'location',
        label: 'Location (JSON)',
        hint: 'If mapped, this overrides separate lat/long for that row.'
      }
    ]
  }
]

/** Minimum time the matching modal stays visible (avoids a flash when work finishes quickly). */
const MATCHING_MODAL_MIN_MS = 12_000

/** Displayed bar creeps toward the real target at most this many % per second (avoids jumping to ~98%). */
const MATCHING_PROGRESS_MAX_PCT_PER_SEC = 4
/** Slightly quicker crawl only in the first segment so the bar starts moving nicely */
const MATCHING_PROGRESS_FAST_UNTIL_PCT = 20
const MATCHING_PROGRESS_FAST_MAX_PCT_PER_SEC = 6.5

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function newCorrectionLogId(matchIndex: number): string {
  try {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${matchIndex}-${Math.random().toString(36).slice(2, 9)}`
  } catch {
    return `${Date.now()}-${matchIndex}-${Math.random().toString(36).slice(2, 9)}`
  }
}

/** One-line label for a database station in migration UI */
function formatMigrationStationLabel(station: FirebaseStationLike | null | undefined): string {
  if (!station) return '—'
  const name = (station.stationName || station.stationname || '').trim() || 'Unknown station'
  const crs = (station.crsCode || station.CrsCode || '').trim()
  const id = String(station.id ?? '').trim()
  const head = crs ? `${name} (${crs})` : name
  return id ? `${head} · ID ${id}` : head
}

function animateProgressOverMs(
  fromPercent: number,
  toPercent: number,
  durationMs: number,
  onTick: (pct: number) => void
): Promise<void> {
  if (durationMs <= 0) {
    onTick(Math.round(toPercent))
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const start = performance.now()
    const from = Math.max(0, Math.min(100, fromPercent))
    const to = Math.max(0, Math.min(100, toPercent))
    const tick = () => {
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / durationMs)
      const p = from + (to - from) * easeOutQuad(t)
      onTick(Math.round(p))
      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        onTick(Math.round(to))
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

type MigrationReviewSummaryStats = NonNullable<MigrationState['result']>['stats']

type MigrationReviewSummarySectionProps = {
  stats: MigrationReviewSummaryStats
  headingId: string
  overviewLegendId: string
  matchLegendId: string
  fileLegendId: string
  attentionLegendId: string
  description: React.ReactNode
}

/** Shared Summary panel for Step 3 (review) and Step 4 (duplicates). */
function MigrationReviewSummarySection({
  stats,
  headingId,
  overviewLegendId,
  matchLegendId,
  fileLegendId,
  attentionLegendId,
  description
}: MigrationReviewSummarySectionProps) {
  const showAttention = stats.rejected > 0 || stats.duplicateIds > 0
  return (
    <section className="review-summary-card" aria-labelledby={headingId}>
      <div className="review-summary-card-head">
        <h3 id={headingId} className="review-summary-card-title">
          Summary
        </h3>
        <p className="review-summary-card-desc">{description}</p>
      </div>
      <div className="migration-stats review-stats-grid">
        <div className="review-stats-rows">
          <div className="review-stats-band review-stats-band--overview">
            <p className="review-stats-row-label" id={overviewLegendId}>
              Overview
            </p>
            <div
              className="review-stats-row review-stats-row--primary"
              role="group"
              aria-labelledby={overviewLegendId}
            >
              <div className="stat-card stat-card--overview">
                <h3>Total stations</h3>
                <span className="stat-number">{stats.total}</span>
              </div>
              <div className="stat-card stat-card--overview">
                <h3>Matched</h3>
                <span className="stat-number">{stats.matched}</span>
              </div>
              <div className="stat-card stat-card--overview">
                <h3>Unmatched</h3>
                <span className="stat-number">{stats.unmatched}</span>
              </div>
            </div>
          </div>

          <div className="review-stats-detail-layout">
            <div className="review-stats-pill-group">
              <p className="review-stats-pill-group-legend" id={matchLegendId}>
                How they matched
              </p>
              <div
                className="review-stats-pill-group-grid review-stats-pill-group-grid--match"
                role="group"
                aria-labelledby={matchLegendId}
              >
                <div className="stat-card stat-card--exact">
                  <h3>Exact match</h3>
                  <span className="stat-number">{stats.exactMatches}</span>
                </div>
                <div className="stat-card stat-card--fuzzy">
                  <h3>Fuzzy match</h3>
                  <span className="stat-number">{stats.fuzzyMatches}</span>
                </div>
              </div>
            </div>

            <div className="review-stats-pill-group">
              <p className="review-stats-pill-group-legend" id={fileLegendId}>
                From your file
              </p>
              <div
                className="review-stats-pill-group-grid review-stats-pill-group-grid--file"
                role="group"
                aria-labelledby={fileLegendId}
              >
                <div className="stat-card visited">
                  <h3>Visited</h3>
                  <span className="stat-number">{stats.visited}</span>
                </div>
                <div className="stat-card favorites stat-card--favorites-file">
                  <h3>Favorites</h3>
                  <span className="stat-number">{stats.favorites}</span>
                </div>
              </div>
            </div>

            {showAttention ? (
              <div className="review-stats-pill-group review-stats-pill-group--attention">
                <p className="review-stats-pill-group-legend" id={attentionLegendId}>
                  Needs attention
                </p>
                <div
                  className="review-stats-pill-group-grid review-stats-pill-group-grid--attention"
                  role="group"
                  aria-labelledby={attentionLegendId}
                >
                  {stats.rejected > 0 ? (
                    <div className="stat-card rejected">
                      <h3>Rejected</h3>
                      <span className="stat-number">{stats.rejected}</span>
                    </div>
                  ) : null}
                  {stats.duplicateIds > 0 ? (
                    <div className="stat-card duplicates">
                      <h3>Same station twice</h3>
                      <span className="stat-number">{stats.duplicateIds}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

const MigrationPage: React.FC = () => {
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
    matchingPhase: 'idle',
    matchingIndex: 0,
    matchingTotal: 0,
    matchingStatusLine: '',
    detectedFormat: null,
    correctionsCount: 0,
    duplicateGroupsSnapshot: null,
    correctionLog: []
  })

  const selectedMatch = state.selectedMatchIndex !== null ? state.matches[state.selectedMatchIndex] : null

  // Table search and display state
  const [tableState, setTableState] = useState({
    finalDataSearch: '',
    allDataSearch: '',
    showAllFinalData: false,
    showAllAllData: false
  })

  const [uploadDragActive, setUploadDragActive] = useState(false)

  const [searchParams, setSearchParams] = useSearchParams()
  const searchMatchIndexParam = searchParams.get('matchIndex')
  const isSearchPageMode = searchParams.get('search') === '1' && searchMatchIndexParam !== null && searchMatchIndexParam !== ''

  const savedScrollPositionRef = useRef(0)
  const prevSearchPageModeRef = useRef(false)
  const showProgressModalRef = useRef(false)
  showProgressModalRef.current = state.showProgressModal
  /** Real % from matchStations; the UI bar chases this with a speed cap */
  const matchingProgressTargetRef = useRef(0)
  /** Last rendered bar % (read when stopping the smoother for finalize animation) */
  const matchingProgressDisplayRef = useRef(0)
  const matchingProgressSmoothingStopRef = useRef(false)
  const matchingProgressRafRef = useRef<number | null>(null)

  // Smooth progress bar: chase matchingProgressTargetRef without big jumps
  useEffect(() => {
    if (!state.showProgressModal) {
      matchingProgressSmoothingStopRef.current = false
      matchingProgressTargetRef.current = 0
      matchingProgressDisplayRef.current = 0
      if (matchingProgressRafRef.current !== null) {
        cancelAnimationFrame(matchingProgressRafRef.current)
        matchingProgressRafRef.current = null
      }
      return
    }

    matchingProgressSmoothingStopRef.current = false
    matchingProgressDisplayRef.current = state.matchingProgress
    matchingProgressTargetRef.current = Math.max(
      matchingProgressTargetRef.current,
      state.matchingProgress
    )

    let lastTs = performance.now()
    const tick = (now: number) => {
      if (!showProgressModalRef.current || matchingProgressSmoothingStopRef.current) {
        matchingProgressRafRef.current = null
        return
      }
      const dt = Math.min(0.12, (now - lastTs) / 1000)
      lastTs = now
      const target = matchingProgressTargetRef.current
      const d = matchingProgressDisplayRef.current
      const maxPerSec =
        d < MATCHING_PROGRESS_FAST_UNTIL_PCT
          ? MATCHING_PROGRESS_FAST_MAX_PCT_PER_SEC
          : MATCHING_PROGRESS_MAX_PCT_PER_SEC
      const maxStep = maxPerSec * dt
      const diff = target - d

      let rounded: number
      if (Math.abs(diff) < 0.08) {
        rounded = Math.min(100, Math.round(target))
      } else {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep)
        const next = Math.min(100, Math.max(0, d + step))
        rounded = Math.round(next)
      }
      matchingProgressDisplayRef.current = rounded

      setState((prev) => {
        if (!prev.showProgressModal) return prev
        return prev.matchingProgress === rounded ? prev : { ...prev, matchingProgress: rounded }
      })

      matchingProgressRafRef.current = requestAnimationFrame(tick)
    }

    matchingProgressRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (matchingProgressRafRef.current !== null) {
        cancelAnimationFrame(matchingProgressRafRef.current)
        matchingProgressRafRef.current = null
      }
    }
  }, [state.showProgressModal])
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

  useEffect(() => {
    if (state.step !== 'upload') setUploadDragActive(false)
  }, [state.step])

  const processCsvFile = useCallback((file: File) => {
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

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      processCsvFile(file)
      event.target.value = ''
    },
    [processCsvFile]
  )

  const handleUploadDragEnterCapture = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!e.dataTransfer.types.includes('Files')) return
    setUploadDragActive(true)
  }, [])

  const handleUploadDragLeaveCapture = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setUploadDragActive(false)
  }, [])

  const handleUploadDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleUploadDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setUploadDragActive(false)
      const files = e.dataTransfer.files
      if (!files?.length) return
      const csvFile = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.csv'))
      if (!csvFile) {
        setState((prev) => ({ ...prev, error: 'Please drop a CSV file' }))
        return
      }
      processCsvFile(csvFile)
    },
    [processCsvFile]
  )

  const handleConfirmMapping = useCallback(() => {
    if (!state.rawCsvContent || !state.columnMapping) return
    try {
      const allStations = parseCSVWithColumnMapping(state.rawCsvContent, state.columnMapping)
      const { allowed, rejected } = filterStationsByCountry(allStations)
      // Store parsed rows, then immediately start matching (skips the old "Step 3" page)
      setState(prev => ({
        ...prev,
        oldFormatData: allowed,
        rejectedStations: rejected,
        error: null
      }))
      // Kick off matching right away using the parsed data we already have
      void (async () => {
        if (allowed.length === 0) return

        const startedAt = performance.now()

        setState(prev => ({
          ...prev,
          step: 'mapping',
          loading: true,
          error: null,
          showProgressModal: true,
          matchingProgress: 2,
          currentStationName: '',
          matchingPhase: 'loading-db',
          matchingStatusLine: 'Connecting to the live station database…',
          matchingIndex: 0,
          matchingTotal: allowed.length
        }))

        try {
          const { matches, availableStations } = await matchStations(
            allowed,
            (info) => {
              matchingProgressTargetRef.current = info.percent
              setState((prev) => ({
                ...prev,
                matchingPhase: info.phase,
                matchingStatusLine: info.statusLine,
                currentStationName: info.currentStationName ?? '',
                matchingIndex: info.index ?? prev.matchingIndex,
                matchingTotal: info.total ?? prev.matchingTotal
              }))
            },
            collectionId
          )

          matchingProgressSmoothingStopRef.current = true
          if (matchingProgressRafRef.current !== null) {
            cancelAnimationFrame(matchingProgressRafRef.current)
            matchingProgressRafRef.current = null
          }
          matchingProgressTargetRef.current = 100

          const elapsed = performance.now() - startedAt
          const remaining = MATCHING_MODAL_MIN_MS - elapsed
          const fromPct = Math.min(100, matchingProgressDisplayRef.current)

          if (remaining > 0) {
            setState((prev) => ({
              ...prev,
              matchingPhase: 'finalizing',
              matchingStatusLine: 'Preparing your review — almost done…',
              currentStationName: ''
            }))
            await animateProgressOverMs(fromPct, 100, remaining, (pct) => {
              matchingProgressDisplayRef.current = pct
              setState((prev) => ({ ...prev, matchingProgress: pct }))
            })
          } else {
            matchingProgressDisplayRef.current = 100
            setState((prev) => ({ ...prev, matchingProgress: 100, matchingPhase: 'finalizing' }))
          }

          const result = generateMigrationResult(matches, rejected, availableStations)
          setState((prev) => ({
            ...prev,
            matches,
            result,
            step: 'review',
            loading: false,
            showProgressModal: false,
            correctionsCount: 0,
            matchingPhase: 'idle',
            matchingProgress: 0,
            matchingIndex: 0,
            matchingTotal: 0,
            matchingStatusLine: '',
            currentStationName: ''
          }))
        } catch (error) {
          setState((prev) => ({
            ...prev,
            error: `Error matching stations: ${error instanceof Error ? error.message : 'Unknown error'}`,
            loading: false,
            showProgressModal: false,
            matchingPhase: 'idle',
            matchingProgress: 0,
            matchingIndex: 0,
            matchingTotal: 0,
            matchingStatusLine: '',
            currentStationName: ''
          }))
        }
      })()
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Error applying mapping: ${error instanceof Error ? error.message : 'Unknown error'}`
      }))
    }
  }, [state.rawCsvContent, state.columnMapping, collectionId])

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
    if (
      duplicateIds > 0 &&
      !window.confirm(
        `You still have ${duplicateIds} group${duplicateIds === 1 ? '' : 's'} where the same station may show twice on the right. Continue to summary anyway?`
      )
    ) {
      return
    }
    setState(prev => ({ ...prev, step: 'reviewChanges', duplicateGroupsSnapshot: null }))
  }, [state.result?.stats?.duplicateIds])

  const handleBackFromReviewChanges = useCallback(() => {
    setState(prev => ({ ...prev, step: 'duplicates' }))
  }, [])

  const handleContinueToComplete = useCallback(() => {
    setState(prev => ({ ...prev, step: 'complete', duplicateGroupsSnapshot: null }))
  }, [])

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
      matchingPhase: 'idle',
      matchingIndex: 0,
      matchingTotal: 0,
      matchingStatusLine: '',
      detectedFormat: null,
      correctionsCount: 0,
      duplicateGroupsSnapshot: null,
      correctionLog: []
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

  const handleSelectStation = useCallback((matchIndex: number, selectedStation: FirebaseStationLike) => {
    setState(prev => {
      const prior = prev.matches[matchIndex]
      const newMatches = [...prev.matches]
      const wasNoMatch = newMatches[matchIndex].matchType === 'none'
      newMatches[matchIndex] = {
        ...newMatches[matchIndex],
        firebaseStation: selectedStation,
          matchType: 'manual',
        confidence: 1.0,
        suggestedId: selectedStation.id || '',
        suggestedCrsCode: selectedStation.crsCode || '',
        suggestedTiploc: selectedStation.tiploc || '',
        ...(wasNoMatch ? { correctedFromNoMatch: true } : {})
      }
      // Use the same availableStations as the current result (same collection), not current hook list
      const availableStations = prev.result?.availableStations ?? firebaseStations
      const newResult = generateMigrationResult(newMatches, prev.rejectedStations, availableStations)

      const previousStationLabel = prior.firebaseStation
        ? formatMigrationStationLabel(prior.firebaseStation)
        : prior.matchType === 'none'
          ? 'No automatic match'
          : '—'

      const phase: MigrationCorrectionLogEntry['phase'] = prev.step === 'duplicates' ? 'duplicates' : 'review'
      const logEntry: MigrationCorrectionLogEntry = {
        id: newCorrectionLogId(matchIndex),
        matchIndex,
        csvStationName: prior.oldStation.stationName || `Row ${matchIndex + 1}`,
        previousMatchType: prior.matchType,
        previousStationId: String(prior.firebaseStation?.id ?? prior.suggestedId ?? ''),
        previousStationLabel,
        newStationId: String(selectedStation.id ?? ''),
        newStationLabel: formatMigrationStationLabel(selectedStation),
        phase
      }

      return {
        ...prev,
        matches: newMatches,
        result: newResult,
        showSearchModal: false,
        selectedMatchIndex: null,
        searchQuery: '',
        searchResults: [],
        correctionsCount: (prev.correctionsCount ?? 0) + 1,
        correctionLog: [...prev.correctionLog, logEntry]
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
      setSearchParams({}, { replace: true })
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
  const filterTableData = useCallback((data: NewFormatStation[], searchQuery: string) => {
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

  const getDisplayData = useCallback((data: NewFormatStation[], searchQuery: string, showAll: boolean) => {
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

  /** Step 3: medium/low fuzzy buckets + whether the fuzzy confidence block should render (avoids empty gap + duplicate legend). */
  const reviewFuzzyConfidence = useMemo(() => {
    if (state.step !== 'review' || !state.result) {
      return { amberMatches: [] as StationMatch[], redMatches: [] as StationMatch[], showFuzzyConfidenceSection: false }
    }
    const matches = state.result.matches
    const amberMatches = matches.filter(
      (m) => m.matchType === 'fuzzy' && m.confidence >= 0.6 && m.confidence < 0.8
    )
    const redMatches = matches.filter(
      (m) => m.matchType === 'fuzzy' && m.confidence >= 0.3 && m.confidence < 0.6
    )
    const showFuzzyConfidenceSection =
      state.result.stats.fuzzyMatches > 0 && (amberMatches.length > 0 || redMatches.length > 0)
    return { amberMatches, redMatches, showFuzzyConfidenceSection }
  }, [state.step, state.result])

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
          <Button
            type="button"
            variant="wide"
            width="hug"
            className="search-page-back"
            ariaLabel="Back to migration"
            onClick={() => handleCloseSearchModal()}
          >
            ← Back to migration
          </Button>
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
                <Button type="button" variant="chip" width="hug" className="quick-search-btn" onClick={() => handleSearchStations(selectedMatch?.oldStation.stationName || '')}>+ Station name</Button>
                {selectedMatch?.oldStation.county && <Button type="button" variant="chip" width="hug" className="quick-search-btn" onClick={() => handleSearchStations(`${selectedMatch.oldStation.stationName} ${selectedMatch.oldStation.county}`)}>+ County</Button>}
                {selectedMatch?.oldStation.country && <Button type="button" variant="chip" width="hug" className="quick-search-btn" onClick={() => handleSearchStations(`${selectedMatch.oldStation.stationName} ${selectedMatch.oldStation.country}`)}>+ Country</Button>}
                {selectedMatch?.suggestedCrsCode && <Button type="button" variant="chip" width="hug" className="quick-search-btn" onClick={() => handleSearchStations(selectedMatch.suggestedCrsCode)}>CRS</Button>}
                {selectedMatch?.suggestedTiploc && <Button type="button" variant="chip" width="hug" className="quick-search-btn" onClick={() => handleSearchStations(selectedMatch.suggestedTiploc)}>TIPLOC</Button>}
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
                <Button type="button" variant="wide" width="hug" className="search-run-button" onClick={() => handleSearchStations(state.searchQuery)}>Search</Button>
              </div>
              <p className="search-by-label">Search by field only</p>
              <div className="search-by-row">
                <div className="search-by-buttons" aria-label="Search by field only">
                  <Button type="button" variant="chip" width="hug" className={`search-by-btn ${state.searchByField === 'name' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('name', selectedMatch?.oldStation.stationName || '')}>Name</Button>
                  <Button type="button" variant="chip" width="hug" className={`search-by-btn ${state.searchByField === 'crs' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('crs', state.searchQuery.trim().slice(0, 3))} title="Search by CRS code (3 characters)">CRS</Button>
                  <Button type="button" variant="chip" width="hug" className={`search-by-btn ${state.searchByField === 'tiploc' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('tiploc', state.searchQuery.trim())} title="Search by TIPLOC">TIPLOC</Button>
                  {selectedMatch?.oldStation.county && <Button type="button" variant="chip" width="hug" className={`search-by-btn ${state.searchByField === 'county' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('county', selectedMatch.oldStation.county)}>County</Button>}
                  {selectedMatch?.oldStation.country && <Button type="button" variant="chip" width="hug" className={`search-by-btn ${state.searchByField === 'country' ? 'search-by-btn-active' : ''}`} onClick={() => handleSearchByField('country', selectedMatch.oldStation.country)}>Country</Button>}
                </div>
                {state.searchByField !== null && (
                  <Button
                    type="button"
                    variant="circle"
                    className="search-by-clear"
                    ariaLabel="Remove search-by filter"
                    onClick={(e) => {
                      e.preventDefault()
                      handleClearSearchByField()
                    }}
                  >
                    ×
                  </Button>
                )}
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
                        if (isSearchPageMode) setSearchParams({}, { replace: true })
                      }}
                    >
                      <div className="result-station-name">{station.stationName}</div>
                      <div className="result-details">
                        <span className="station-chip station-chip-primary">{station.crsCode}</span>
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
      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}

      {/* Step 1: File Upload */}
      {state.step === 'upload' && (
        <div className="migration-step upload-step">
          <header className="mapping-step-header">
            <span className="mapping-step-eyebrow">Step 1 of 6</span>
            <h2 className="mapping-step-title">Upload your CSV</h2>
            <p className="mapping-step-lead">
              Choose an <strong>old-format</strong> station list as a <strong>.csv</strong> file. You’ll map columns next,
              then we’ll match rows against the live station database.
            </p>
            <div className="mapping-step-meta-row upload-step-meta-row">
              <div className="mapping-step-meta">
                <span className="mapping-step-meta-item">.csv only</span>
                <span className="mapping-step-meta-dot" aria-hidden />
                <span className="mapping-step-meta-item">UTF-8 text</span>
                {state.file ? (
                  <>
                    <span className="mapping-step-meta-dot" aria-hidden />
                    <span className="mapping-step-meta-item">File ready</span>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          <div className="upload-panel">
            <div
              className={`upload-area${uploadDragActive ? ' upload-area--drag-active' : ''}`}
              onDragEnterCapture={handleUploadDragEnterCapture}
              onDragLeaveCapture={handleUploadDragLeaveCapture}
              onDragOver={handleUploadDragOver}
              onDrop={handleUploadDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="file-input"
                id="csv-upload"
              />
              <p className="upload-area-hint">
                Drag a <strong>.csv</strong> here, or use the button to choose a file.
              </p>
              <Button
                type="button"
                variant="wide"
                width="hug"
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                {state.file ? 'Change file' : 'Choose CSV file'}
              </Button>
              {state.file ? (
                <div className="upload-file-summary">
                  <span className="upload-file-name">{state.file.name}</span>
                  <span className="upload-file-size">{(state.file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Column mapping */}
      {state.step === 'mapping' && state.columnMapping && (
        <div className="migration-step mapping-step">
          <header className="mapping-step-header">
            <span className="mapping-step-eyebrow">Step 2 of 6</span>
            <h2 className="mapping-step-title">Map your CSV columns</h2>
            <p className="mapping-step-lead">
              Link each output field to a column from your file. <strong>Station name</strong> is required; everything
              else is optional. Use the preview to confirm headers and sample values.
            </p>
            <div className="mapping-step-meta-row">
              <div className="mapping-step-meta" aria-live="polite">
                <span className="mapping-step-meta-item">
                  {state.rawHeaders.length} column{state.rawHeaders.length === 1 ? '' : 's'} in file
                </span>
                <span className="mapping-step-meta-dot" aria-hidden />
                <span className="mapping-step-meta-item">
                  {(() => {
                    const mapped = Object.values(state.columnMapping).filter((v) => (v ?? '').trim() !== '').length
                    const total = Object.keys(state.columnMapping).length
                    return `${mapped} of ${total} fields mapped`
                  })()}
                </span>
              </div>
              <div className="mapping-step-header-actions">
                <Button type="button" variant="wide" width="hug" onClick={handleReset}>
                  Restart
                </Button>
                <Button type="button" onClick={handleConfirmMapping} variant="wide" width="hug">
                  Continue to matching
                </Button>
              </div>
            </div>
          </header>

          <div className="mapping-layout">
            <div className="mapping-panel" aria-label="Column mapping">
              {COLUMN_MAPPING_SECTIONS.map((section) => (
                <section key={section.title} className="mapping-section">
                  <div className="mapping-section-head">
                    <h3 className="mapping-section-title">{section.title}</h3>
                    <p className="mapping-section-desc">{section.description}</p>
                  </div>
                  <ul className="mapping-field-list">
                    {section.fields.map(({ key, label, hint, required }) => {
                      const selectId = `mapping-select-${key}`
                      const value =
                        key === 'location' ? (state.columnMapping!.location ?? '') : state.columnMapping![key]
                      return (
                        <li key={key} className="mapping-field-item">
                          <div className="mapping-field-label-block">
                            <label className="mapping-field-label" htmlFor={selectId}>
                              {label}
                            </label>
                            <div className="mapping-field-tags">
                              {required ? (
                                <span className="mapping-tag mapping-tag--required">Required</span>
                              ) : (
                                <span className="mapping-tag mapping-tag--optional">Optional</span>
                              )}
                            </div>
                            {hint ? <p className="mapping-field-hint">{hint}</p> : null}
                          </div>
                          <select
                            id={selectId}
                            className="mapping-select"
                            value={value}
                            onChange={(e) => setColumnMappingField(key, e.target.value)}
                          >
                            <option value="">— Skip this field —</option>
                            {state.rawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>

            <aside className="mapping-preview-panel" aria-label="CSV preview">
              <div className="mapping-preview-card">
                <div className="mapping-preview-header">
                  <div>
                    <h3 className="mapping-preview-heading">Raw data preview</h3>
                    <p className="mapping-preview-sub">First 5 rows from your upload — scroll horizontally if needed.</p>
                  </div>
                  <div className="mapping-preview-badges">
                    <span className="mapping-preview-badge">{state.rawPreviewRows.length} rows</span>
                    <span className="mapping-preview-badge">{state.rawHeaders.length} cols</span>
                  </div>
                </div>
                <div className="mapping-preview-table-wrap">
                  <table className="mapping-preview-table">
                    <thead>
                      <tr>
                        {state.rawHeaders.map((h) => (
                          <th key={h} title={h}>
                            {h.length > 14 ? `${h.slice(0, 13)}…` : h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.rawPreviewRows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} title={String(cell)}>
                              {String(cell).length > 18 ? `${String(cell).slice(0, 17)}…` : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </aside>
          </div>

          <div className="mapping-actions mapping-actions--bottom">
            <Button type="button" variant="wide" width="hug" onClick={handleReset}>
              Restart
            </Button>
            <Button type="button" onClick={handleConfirmMapping} variant="wide" width="hug">
              Continue to matching
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review Results */}
      {state.step === 'review' && state.result && (
        <div className="migration-step review-step">
          <header className="mapping-step-header review-step-header">
            <span className="mapping-step-eyebrow">Step 3 of 6</span>
            <h2 className="mapping-step-title">Review your matches</h2>
            <p className="mapping-step-lead">
              Scan <strong>fuzzy</strong> and <strong>unmatched</strong> rows below. Use <strong>Correct</strong> to pick the right
              database station, then continue to check rows where the same station might appear twice on the right when you’re ready.
            </p>
          </header>

          <MigrationReviewSummarySection
            stats={state.result.stats}
            headingId="review-summary-heading"
            overviewLegendId="review-stats-overview-label"
            matchLegendId="review-stats-match-label"
            fileLegendId="review-stats-file-label"
            attentionLegendId="review-stats-attention-label"
            description="All counts in one place — including how rows matched (exact vs fuzzy) and what still needs attention."
          />

          {/* Fuzzy Match Confidence Rankings (only when there are medium/low buckets to show) */}
          {reviewFuzzyConfidence.showFuzzyConfidenceSection && (
            <div className="review-subsection fuzzy-match-ranks">
              <div className="review-subsection-head">
                <h3 className="review-subsection-title">Fuzzy match confidence</h3>
                <p className="review-subsection-desc">
                  Medium and low-confidence matches are listed so you can confirm or re-assign them.
                </p>
              </div>
              <p className="rank-legend">
                <span className="rank-legend-from">From your file</span>
                <span className="rank-legend-arrow">→</span>
                <span className="rank-legend-to">Matched in database</span>
              </p>
              <div className="confidence-ranks">
                {/* Amber - Medium Confidence (60-79%) */}
                {(() => {
                  const amberMatches = reviewFuzzyConfidence.amberMatches
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
                                      {(fb.crsCode || fb.CrsCode) && (
                                        <span className="station-chip station-chip-primary">{fb.crsCode || fb.CrsCode}</span>
                                      )}
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
                  const redMatches = reviewFuzzyConfidence.redMatches
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
                                      {(fb.crsCode || fb.CrsCode) && (
                                        <span className="station-chip station-chip-primary">{fb.crsCode || fb.CrsCode}</span>
                                      )}
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
              <div className="review-subsection no-matches-section rejected-stations-section">
                <div className="review-subsection-head">
                  <h3 className="review-subsection-title review-subsection-title--warn">
                    No automatic match{' '}
                    <span className="review-count-badge">{noMatchEntries.length}</span>
                  </h3>
                  <p className="review-subsection-desc">
                    These stations had no automatic match. Use <strong>Correct</strong> to search and pick a station (or change
                    your choice). Rows you already fixed stay here so you can change them again if needed.
                  </p>
                  {!reviewFuzzyConfidence.showFuzzyConfidenceSection ? (
                    <p className="rank-legend">
                      <span className="rank-legend-from">From your file</span>
                      <span className="rank-legend-arrow">→</span>
                      <span className="rank-legend-to">Matched in database</span>
                    </p>
                  ) : null}
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
                                {(fb.crsCode || fb.CrsCode) && (
                                  <span className="station-chip station-chip-primary">{fb.crsCode || fb.CrsCode}</span>
                                )}
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
            <div className="review-subsection rejected-stations-section">
              <div className="review-subsection-head">
                <h3 className="review-subsection-title review-subsection-title--danger">
                  Rejected stations{' '}
                  <span className="review-count-badge">{state.result.rejected.length}</span>
                </h3>
                <p className="review-subsection-desc">
                  These rows are outside England, Scotland, or Wales and are not included in the migration output.
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

          <div className="mapping-actions mapping-actions--bottom review-step-footer-actions">
            <Button type="button" onClick={handleReset} variant="wide" width="hug">
              Restart
            </Button>
            <Button type="button" onClick={handleContinueToDuplicates} variant="wide" width="hug">
              Next: Same station twice?
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Duplicates — layout aligned with Step 3 (review) */}
      {state.step === 'duplicates' && state.result && (
        <div className="migration-step review-step duplicates-step">
          <header className="mapping-step-header review-step-header">
            <span className="mapping-step-eyebrow">Step 4 of 6</span>
            <h2 className="mapping-step-title">When the same station shows twice</h2>
            <p className="mapping-step-lead">
              Compare the <strong>Matched in database</strong> column on the right — if the same station appears for more than one row,
              one of them is probably wrong. Use <strong>Correct</strong> to pick the right station for each line, then continue to the
              summary when you’re ready.
            </p>
          </header>

          <MigrationReviewSummarySection
            stats={state.result.stats}
            headingId="duplicates-summary-heading"
            overviewLegendId="duplicates-stats-overview-label"
            matchLegendId="duplicates-stats-match-label"
            fileLegendId="duplicates-stats-file-label"
            attentionLegendId="duplicates-stats-attention-label"
            description={
              <>
                Same overview as review — counts stay in sync after corrections. Groups where the same matched station appears more
                than once are listed below when present.
              </>
            }
          />

          {(() => {
            const duplicateGroupsToShow = (state.step === 'duplicates' && state.duplicateGroupsSnapshot && state.duplicateGroupsSnapshot.length > 0)
              ? state.duplicateGroupsSnapshot
              : (state.result?.duplicateGroups ?? [])
            const hasDuplicateSections = duplicateGroupsToShow.length > 0 && state.result?.outputIds
            return hasDuplicateSections ? (
            <section className="review-subsection duplicates-step-section" aria-labelledby="duplicate-ids-heading">
              <div className="review-subsection-head">
                <h3 id="duplicate-ids-heading" className="review-subsection-title">Same station on the right</h3>
                <p className="review-subsection-desc">
                  These rows share the same matched station on the right. Use <strong>Correct</strong> so each line points at the right
                  place.
                </p>
              </div>
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
                  return { indicesInRange }
                })
                const firstOpenIndex = groupsWithRanges.findIndex((g) => g.indicesInRange.length > 0)
                return groupsWithRanges.map(({ indicesInRange }, gIdx) => {
                  const isResolved = indicesInRange.length === 0
                  const isOpen = !isResolved && gIdx === firstOpenIndex
                  return (
                  <details
                    key={gIdx}
                    className={`duplicate-group-details duplicate-group-block${isResolved ? ' duplicate-group-resolved' : ''}`}
                    open={isOpen}
                  >
                    <summary className="duplicate-group-summary">
                      <div className="duplicate-group-summary-main">
                        {isResolved && (
                          <span className="duplicate-group-resolved-check" aria-hidden="true">✓</span>
                        )}
                        <span className="duplicate-group-title">
                          {indicesInRange.length} row{indicesInRange.length === 1 ? '' : 's'} · same station on the right
                        </span>
                      </div>
                      <span className="duplicate-group-chevron" aria-hidden="true">
                        <svg
                          className="duplicate-group-chevron-icon"
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </summary>
                    {indicesInRange.length > 0 && (
                      <div className="duplicate-expected" role="note">
                        <p className="duplicate-expected-note">
                          Look at <strong>Matched in database</strong> on the right: the same station is listed more than once, so one
                          row is likely wrong. Use <strong>Correct</strong> on the lines that don’t belong until each row shows the
                          right station.
                        </p>
                      </div>
                    )}
                    <div className="rank-matches no-match-cards">
                      {indicesInRange.length === 0 ? (
                        <p className="duplicate-group-all-resolved">All set — each row now has its own matched station on the right.</p>
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
                                    {(fb.crsCode || fb.CrsCode) && (
                                      <span className="station-chip station-chip-primary">{fb.crsCode || fb.CrsCode}</span>
                                    )}
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
                  </details>
                  )
                })
              })()}
            </section>
          ) : (
            <div className="review-subsection duplicates-step-empty" role="status">
              <p className="duplicates-step-empty-message">
                Nothing to fix here — each row has a different matched station on the right.
              </p>
            </div>
          )
          })()}
          {state.result.mismatchedMatchIndices && state.result.mismatchedMatchIndices.length > 0 && (
            <section className="review-subsection mismatched-step-section" aria-labelledby="mismatched-heading">
              <div className="review-subsection-head">
                <h3 id="mismatched-heading" className="review-subsection-title review-subsection-title--warn">
                  Possible mis-matches
                </h3>
                <p className="review-subsection-desc">
                  These rows may be matched to the wrong station (e.g. low-confidence fuzzy or qualifier mismatch). Use{' '}
                  <strong>Correct</strong> to fix.
                </p>
              </div>
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
                              {(fb.crsCode || fb.CrsCode) && (
                                <span className="station-chip station-chip-primary">{fb.crsCode || fb.CrsCode}</span>
                              )}
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
          <div className="mapping-actions mapping-actions--bottom review-step-footer-actions">
            <Button type="button" onClick={handleBackToReview} variant="wide" width="hug">
              Back to review
            </Button>
            <Button type="button" onClick={handleContinueToSummary} variant="wide" width="hug">
              Next: Review changes
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Review changes (all Correct actions from review + duplicates) */}
      {state.step === 'reviewChanges' && state.result && (() => {
        const reviewCorrections = state.correctionLog.filter((c) => c.phase === 'review')
        const duplicateCorrections = state.correctionLog.filter((c) => c.phase === 'duplicates')
        const renderCorrectionRow = (entry: MigrationCorrectionLogEntry, sequence: number) => (
          <li key={entry.id} className="correction-log-item">
            <div className="correction-log-item-meta">
              <span className="correction-log-order">{sequence}</span>
              <span className="correction-log-row-label">
                Row {entry.matchIndex + 1}
                <span className="correction-log-csv-name">{entry.csvStationName}</span>
              </span>
            </div>
            <div className="correction-log-change">
              <div className="correction-log-line correction-log-line--from">
                <span className="correction-log-line-label">Was</span>
                <span className="correction-log-line-value">{entry.previousStationLabel}</span>
                <span className="correction-log-match-type">({entry.previousMatchType})</span>
              </div>
              <div className="correction-log-line correction-log-line--to">
                <span className="correction-log-line-label">Now</span>
                <span className="correction-log-line-value">{entry.newStationLabel}</span>
              </div>
            </div>
          </li>
        )
        return (
          <div className="migration-step review-step review-changes-step">
            <header className="mapping-step-header review-step-header">
              <span className="mapping-step-eyebrow">Step 5 of 6</span>
              <h2 className="mapping-step-title">Review your changes</h2>
              <p className="mapping-step-lead">
                Every time you used <strong>Correct</strong> during <strong>review</strong> or while fixing rows where the same
                station appeared twice on the right is listed below. When you’re happy, continue to the summary and download.
              </p>
            </header>

            {state.correctionLog.length === 0 ? (
              <section className="review-subsection correction-log-empty" aria-live="polite">
                <p className="review-subsection-desc correction-log-empty-text">
                  No manual corrections were recorded — you didn’t use <strong>Correct</strong> to change a matched station after
                  automatic matching. You can still continue to the summary and download your CSV.
                </p>
              </section>
            ) : (
              <>
                {reviewCorrections.length > 0 && (
                  <section className="review-subsection correction-log-section" aria-labelledby="correction-log-review-heading">
                    <div className="review-subsection-head">
                      <h3 id="correction-log-review-heading" className="review-subsection-title">
                        Review matches <span className="correction-log-count">({reviewCorrections.length})</span>
                      </h3>
                      <p className="review-subsection-desc">Corrections made while reviewing fuzzy, unmatched, or similar rows.</p>
                    </div>
                    <ol className="correction-log-list">
                      {reviewCorrections.map((e, i) => renderCorrectionRow(e, i + 1))}
                    </ol>
                  </section>
                )}
                {duplicateCorrections.length > 0 && (
                  <section className="review-subsection correction-log-section" aria-labelledby="correction-log-dup-heading">
                    <div className="review-subsection-head">
                      <h3 id="correction-log-dup-heading" className="review-subsection-title">
                        Same station twice <span className="correction-log-count">({duplicateCorrections.length})</span>
                      </h3>
                      <p className="review-subsection-desc">
                        Corrections made while fixing rows that showed the same matched station on the right more than once.
                      </p>
                    </div>
                    <ol className="correction-log-list">
                      {duplicateCorrections.map((e, i) =>
                        renderCorrectionRow(e, reviewCorrections.length + i + 1)
                      )}
                    </ol>
                  </section>
                )}
              </>
            )}

            <div className="mapping-actions mapping-actions--bottom review-step-footer-actions">
              <Button type="button" onClick={handleBackFromReviewChanges} variant="wide" width="hug">
                Back to same-station check
              </Button>
              <Button type="button" onClick={handleContinueToComplete} variant="wide" width="hug">
                Continue to summary
              </Button>
            </div>
          </div>
        )
      })()}

      {/* Step 6: Complete / summary */}
      {state.step === 'complete' && state.result && (
        <div className="migration-complete-container">
          {/* Success Header */}
          <div className="success-header">
            <span className="mapping-step-eyebrow migration-complete-eyebrow">Step 6 of 6</span>
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
            </div>
            <h1>Summary</h1>
            <p className="success-subtitle">
              Matches made, any same-station fixes, and output preview. Download your converted CSV below.
            </p>
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
                <h3>Same station twice</h3>
                <div className="card-number">{state.result.stats.duplicateIds}</div>
                <p>Groups to check on the matched column</p>
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

      {/* Progress Modal — matching CSV rows to the live database */}
      {state.showProgressModal && (
        <div className="progress-modal-overlay" role="alertdialog" aria-modal="true" aria-labelledby="matching-modal-title" aria-busy="true">
          <div className="progress-modal">
            <div className="progress-modal-content">
              <div className="progress-modal-top">
                <span className="progress-modal-eyebrow">Step 2 → 3</span>
                <h3 id="matching-modal-title" className="progress-modal-title">
                  Matching your stations
                </h3>
                <p className="progress-modal-lead">{state.matchingStatusLine || 'Working…'}</p>
              </div>

              <div className="progress-modal-steps" aria-hidden="true">
                <div
                  className={`progress-modal-step ${state.matchingPhase === 'loading-db' ? 'progress-modal-step--active' : ''} ${state.matchingPhase === 'matching' || state.matchingPhase === 'finalizing' ? 'progress-modal-step--done' : ''}`}
                >
                  <span className="progress-modal-step-dot" />
                  <span>Load database</span>
                </div>
                <div className="progress-modal-step-line" />
                <div className={`progress-modal-step ${state.matchingPhase === 'matching' ? 'progress-modal-step--active' : ''} ${state.matchingPhase === 'finalizing' ? 'progress-modal-step--done' : ''}`}>
                  <span className="progress-modal-step-dot" />
                  <span>Match rows</span>
                </div>
                <div className="progress-modal-step-line" />
                <div className={`progress-modal-step ${state.matchingPhase === 'finalizing' ? 'progress-modal-step--active' : ''}`}>
                  <span className="progress-modal-step-dot" />
                  <span>Finalize</span>
                </div>
              </div>

              <div className="progress-bar-block">
                <div className="progress-bar-labels">
                  <span className="progress-bar-pct">{Math.min(100, Math.max(0, state.matchingProgress))}%</span>
                  {state.matchingTotal > 0 && state.matchingPhase === 'matching' ? (
                    <span className="progress-bar-count">
                      Row {state.matchingIndex} / {state.matchingTotal}
                    </span>
                  ) : (
                    <span className="progress-bar-count progress-bar-count--muted">
                      {state.matchingPhase === 'loading-db' ? 'Fetching data' : ''}
                      {state.matchingPhase === 'finalizing' ? 'Finishing' : ''}
                      {state.matchingPhase === 'matching' && state.matchingTotal === 0 ? 'Matching' : ''}
                    </span>
                  )}
                </div>
                <div className="progress-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.matchingProgress}>
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, state.matchingProgress))}%` }}
                  />
                </div>
              </div>

              {state.matchingPhase === 'matching' ? (
                <div className="progress-current-row">
                  <span className="progress-current-label">Current row</span>
                  <p
                    className="progress-current-name"
                    title={state.currentStationName || undefined}
                  >
                    {state.currentStationName || 'Processing…'}
                  </p>
                </div>
              ) : (
                <div className="progress-current-row progress-current-row--placeholder">
                  <span className="progress-current-label">
                    {state.matchingPhase === 'loading-db' ? 'Hang tight' : state.matchingPhase === 'finalizing' ? 'Almost there' : '\u00a0'}
                  </span>
                  <p className="progress-current-name progress-current-name--muted">
                    {state.matchingPhase === 'loading-db'
                      ? 'Loading the full station list from the cloud…'
                      : state.matchingPhase === 'finalizing'
                        ? 'Building your review screen…'
                        : '\u00a0'}
                  </p>
                </div>
              )}

              <p className="progress-modal-footnote">You can leave this tab open — matching runs in your browser.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MigrationPage

