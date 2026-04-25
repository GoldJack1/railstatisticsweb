import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStations } from '../../hooks/useStations'
import { useStationCollection } from '../../contexts/StationCollectionContext'
import { 
  matchStations, 
  generateMigrationResult, 
  downloadCSV,
  filterStationsByCountry,
  downloadRejectedStationsCSV,
  getRawCSV,
  suggestColumnMapping,
  parseCSVWithColumnMapping
} from '../../services/migration'
import type {
  MigrationState,
  ColumnMapping,
  FirebaseStationLike,
  StationMatch,
  MigrationCorrectionLogEntry
} from '../../types/migration'
import { BUTBaseButton as Button } from '../../components/buttons'
import { BUTSharedNativeButton } from '../../components/buttons'
import './MigrationPage.css'
import '../../components/models/StationModal/StationModal.css'
import '../StationDetailsPage/StationDetailsPage.css'
import { formatStationLocationDisplay, isGreaterLondonCounty } from '../../utils/formatStationLocation'

/** Row card tint: no DB match (red) vs auto match not yet confirmed with Correct (amber). */
function rankMatchHighlightClass(match: StationMatch): string {
  if (match.matchType === 'manual') return ''
  if (match.matchType === 'none') return 'rank-match--unmatched'
  return 'rank-match--uncorrected'
}

function rankMatchCardClassName(match: StationMatch, extra?: string): string {
  return ['rank-match', rankMatchHighlightClass(match), extra].filter(Boolean).join(' ')
}

/** Step 6 complete: chevron for native `<details>` accordions (matches duplicate-step pattern). */
function MigrationCompleteDetailsChevron() {
  return (
    <span className="migration-complete-details-summary-chevron" aria-hidden="true">
      <svg
        className="migration-complete-details-chevron-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  )
}

/** Migrated CSV download name: `GBStationsDD-MM-YYYY.csv` (local date). */
function getGbStationsDownloadFilename(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  return `GBStations${dd}-${mm}-${yyyy}.csv`
}

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

/** Migration “match station” search: max rows shown & typing debounce (ms). */
const MIGRATION_SEARCH_MAX_RESULTS = 28
const MIGRATION_SEARCH_DEBOUNCE_MS = 260

/** Rank free-text matches so name / CRS / TIPLOC hits surface first. */
/** Remove `( … )` segments, including nested pairs, so e.g. `(Leeds)` does not affect search. */
function stripParentheticalSegments(input: string): string {
  let s = input
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/\([^()]*\)/g, ' ')
  }
  return s
}

function scoreStationForMigrationSearch(
  station: FirebaseStationLike,
  queryWords: string[],
  normalizedQuery: string,
  normalize: (s: string) => string
): number {
  const nameNorm = normalize(station.stationName || station.stationname || '')
  const crs = (station.crsCode || station.CrsCode || '').toLowerCase().replace(/\s+/g, '')
  const tip = (station.tiploc || '').toLowerCase().replace(/\s+/g, '')
  const q = normalizedQuery.replace(/\s+/g, ' ').trim()
  let score = 0

  if (q.length >= 2 && crs && crs === q) score += 100
  if (q.length >= 3 && tip && tip === q) score += 95
  if (crs && q.length <= 4 && crs.startsWith(q)) score += 38
  if (tip && q.length >= 3 && tip.includes(q)) score += 28

  const firstWord = queryWords[0] || ''
  if (firstWord.length >= 2 && nameNorm.startsWith(firstWord)) score += 24
  for (const w of queryWords) {
    if (w.length && nameNorm.includes(w)) score += 7
  }
  if (queryWords.length > 1 && queryWords.every((w) => nameNorm.includes(w))) score += 12
  return score
}

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

/** Step 6 complete dropdown: same stat layout as review, plus coordinate matches and correction count. */
function MigrationCompleteSummaryBody({
  stats,
  correctionsCount
}: {
  stats: MigrationReviewSummaryStats
  correctionsCount: number
}) {
  const overviewId = 'migration-complete-stats-overview'
  const matchId = 'migration-complete-stats-match'
  const fileId = 'migration-complete-stats-file'
  const attentionId = 'migration-complete-stats-attention'
  const correctionsId = 'migration-complete-stats-corrections'
  const showAttention = stats.rejected > 0 || stats.duplicateIds > 0
  return (
    <section
      className="review-summary-card migration-complete-summary-card"
      aria-label="Statistics for this migration run"
    >
      <div className="migration-stats review-stats-grid">
        <div className="review-stats-rows">
          <div className="review-stats-band review-stats-band--overview">
            <p className="review-stats-row-label" id={overviewId}>
              Overview
            </p>
            <div
              className="review-stats-row review-stats-row--primary"
              role="group"
              aria-labelledby={overviewId}
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
              <p className="review-stats-pill-group-legend" id={matchId}>
                How they matched
              </p>
              <div
                className="review-stats-pill-group-grid review-stats-pill-group-grid--match"
                role="group"
                aria-labelledby={matchId}
              >
                <div className="stat-card stat-card--exact">
                  <h3>Exact match</h3>
                  <span className="stat-number">{stats.exactMatches}</span>
                </div>
                <div className="stat-card stat-card--fuzzy">
                  <h3>Fuzzy match</h3>
                  <span className="stat-number">{stats.fuzzyMatches}</span>
                </div>
                {stats.coordinateMatches > 0 ? (
                  <div className="stat-card stat-card--coordinates">
                    <h3>Coordinate match</h3>
                    <span className="stat-number">{stats.coordinateMatches}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="review-stats-pill-group">
              <p className="review-stats-pill-group-legend" id={fileId}>
                From your file
              </p>
              <div
                className="review-stats-pill-group-grid review-stats-pill-group-grid--file"
                role="group"
                aria-labelledby={fileId}
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

            <div className="review-stats-pill-group">
              <p className="review-stats-pill-group-legend" id={correctionsId}>
                Manual review
              </p>
              <div
                className="review-stats-pill-group-grid migration-complete-corrections-grid"
                role="group"
                aria-labelledby={correctionsId}
              >
                <div className="stat-card migration-complete-stat-card--corrections">
                  <h3>Corrections made</h3>
                  <span className="stat-number">{correctionsCount}</span>
                </div>
              </div>
            </div>

            {showAttention ? (
              <div className="review-stats-pill-group review-stats-pill-group--attention">
                <p className="review-stats-pill-group-legend" id={attentionId}>
                  Needs attention
                </p>
                <div
                  className="review-stats-pill-group-grid review-stats-pill-group-grid--attention"
                  role="group"
                  aria-labelledby={attentionId}
                >
                  {stats.rejected > 0 ? (
                    <div className="stat-card rejected">
                      <h3>Rejected</h3>
                      <span className="stat-number">{stats.rejected}</span>
                    </div>
                  ) : null}
                  {stats.duplicateIds > 0 ? (
                    <div className="stat-card duplicates">
                      <h3>Check duplicates</h3>
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
                      <h3>Check duplicates</h3>
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
  const migrationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelMigrationSearchDebounce = useCallback(() => {
    if (migrationSearchDebounceRef.current !== null) {
      clearTimeout(migrationSearchDebounceRef.current)
      migrationSearchDebounceRef.current = null
    }
  }, [])

  useEffect(() => () => cancelMigrationSearchDebounce(), [cancelMigrationSearchDebounce])

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
    downloadCSV(state.result.converted, getGbStationsDownloadFilename())
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
        `You still have ${duplicateIds} duplicate group${duplicateIds === 1 ? '' : 's'} to check. Continue to summary anyway?`
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

  // Normalize text for search: lowercase, strip apostrophes, drop `(qualifiers)` like (Leeds), collapse spaces
  const normalizeSearchText = useCallback((s: string) => {
    if (!s || typeof s !== 'string') return ''
    let t = s.toLowerCase().replace(/[\u2018\u2019\u201A\u201B\u2032']/g, '')
    t = stripParentheticalSegments(t)
    t = t.replace(/[()]/g, ' ')
    t = t.replace(/\s+/g, ' ').trim()
    return t
  }, [])

  // Free-text search across name, codes, county, country, borough — word-based + relevance ranking.
  const filterAndRankStationsFreeText = useCallback(
    (query: string): FirebaseStationLike[] => {
      if (!query.trim()) return []
      const normalizedQuery = normalizeSearchText(query)
      const queryWords = normalizedQuery.split(/\s+/).filter(Boolean)
      const stations = firebaseStations as FirebaseStationLike[]
      const candidates = stations.filter((station) => {
        const name = station.stationName || station.stationname || ''
        const crs = station.crsCode || station.CrsCode || ''
        const tiploc = station.tiploc || ''
        const country = station.country || ''
        const county = station.county || ''
        const borough = station.londonBorough || ''
        const searchable = normalizeSearchText([name, crs, tiploc, country, county, borough].join(' '))

        if (!searchable) return false
        if (normalizedQuery.length <= 1) {
          return searchable.includes(normalizedQuery)
        }
        return queryWords.every((word) => searchable.includes(word))
      })

      const scored = candidates.map((s) => ({
        station: s,
        score: scoreStationForMigrationSearch(s, queryWords, normalizedQuery, normalizeSearchText)
      }))
      scored.sort(
        (a, b) =>
          b.score - a.score ||
          (a.station.stationName || a.station.stationname || '').localeCompare(
            b.station.stationName || b.station.stationname || '',
            undefined,
            { sensitivity: 'base' }
          )
      )
      return scored.map((x) => x.station).slice(0, MIGRATION_SEARCH_MAX_RESULTS)
    },
    [firebaseStations, normalizeSearchText]
  )

  const handleSearchStations = useCallback(
    (query: string) => {
      cancelMigrationSearchDebounce()
      if (!query.trim()) {
        setState((prev) => ({ ...prev, searchQuery: query, searchResults: [], searchByField: null }))
        return
      }
      const results = filterAndRankStationsFreeText(query)
      setState((prev) => ({
        ...prev,
        searchQuery: query,
        searchResults: results,
        searchByField: null
      }))
    },
    [cancelMigrationSearchDebounce, filterAndRankStationsFreeText]
  )

  /** Typing in the box: update text immediately; run search after a short debounce. */
  const handleMigrationSearchInputChange = useCallback(
    (value: string) => {
      cancelMigrationSearchDebounce()
      if (!value.trim()) {
        setState((prev) => ({
          ...prev,
          searchQuery: value,
          searchResults: [],
          searchByField: null
        }))
        return
      }
      setState((prev) => ({ ...prev, searchQuery: value, searchByField: null }))
      migrationSearchDebounceRef.current = setTimeout(() => {
        migrationSearchDebounceRef.current = null
        const results = filterAndRankStationsFreeText(value)
        setState((prev) => ({ ...prev, searchResults: results }))
      }, MIGRATION_SEARCH_DEBOUNCE_MS)
    },
    [cancelMigrationSearchDebounce, filterAndRankStationsFreeText]
  )

  // Search by a single field only (does not fill the search box). Used by "Narrow to one field" chips.
  type SearchByField = 'identifiers' | 'county' | 'country'
  const handleSearchByField = useCallback(
    (field: SearchByField, value: string) => {
      cancelMigrationSearchDebounce()
      const stations = firebaseStations as FirebaseStationLike[]

      if (field === 'identifiers') {
        setState((prev) => {
          const idx = prev.selectedMatchIndex
          const csvName = idx != null ? (prev.matches[idx]?.oldStation.stationName || '').trim() : ''
          const q = prev.searchQuery.trim()
          const qLower = q.toLowerCase()
          const crsToken = q.slice(0, 3).toLowerCase()

          if (!csvName && !q) {
            return { ...prev, searchByField: null, searchResults: [] }
          }

          const results = stations.filter((station) => {
            const nameNorm = normalizeSearchText(station.stationName || station.stationname || '')
            const nameOk =
              csvName.length > 0 && nameNorm.includes(normalizeSearchText(csvName))
            const crsVal = (station.crsCode || station.CrsCode || '').toLowerCase()
            const crsOk = crsToken.length > 0 && crsVal.includes(crsToken)
            const tipVal = (station.tiploc || '').toLowerCase()
            const tipOk = q.length >= 2 && tipVal.includes(qLower)
            return nameOk || crsOk || tipOk
          })

          results.sort((a, b) =>
            (a.stationName || a.stationname || '').localeCompare(b.stationName || b.stationname || '', undefined, {
              sensitivity: 'base'
            })
          )

          return {
            ...prev,
            searchByField: 'identifiers',
            searchResults: results.slice(0, MIGRATION_SEARCH_MAX_RESULTS)
          }
        })
        return
      }

      if (!value?.trim()) {
        setState((prev) => ({ ...prev, searchByField: null, searchResults: [] }))
        return
      }

      const results = stations.filter((station) => {
        switch (field) {
          case 'county':
            return normalizeSearchText(station.county || '').includes(normalizeSearchText(value))
          case 'country':
            return normalizeSearchText(station.country || '').includes(normalizeSearchText(value))
          default:
            return false
        }
      })

      results.sort((a, b) =>
        (a.stationName || a.stationname || '').localeCompare(b.stationName || b.stationname || '', undefined, {
          sensitivity: 'base'
        })
      )

      setState((prev) => ({
        ...prev,
        searchByField: field,
        searchResults: results.slice(0, MIGRATION_SEARCH_MAX_RESULTS)
      }))
    },
    [firebaseStations, normalizeSearchText, cancelMigrationSearchDebounce]
  )

  const handleSelectStation = useCallback((matchIndex: number, selectedStation: FirebaseStationLike) => {
    cancelMigrationSearchDebounce()
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
  }, [firebaseStations, cancelMigrationSearchDebounce])

  const handleOpenSearchModal = useCallback((matchIndex: number) => {
    cancelMigrationSearchDebounce()
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
  }, [setSearchParams, cancelMigrationSearchDebounce])

  const handleCloseSearchModal = useCallback(() => {
    cancelMigrationSearchDebounce()
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
  }, [isSearchPageMode, setSearchParams, cancelMigrationSearchDebounce])

  const handleClearSearchByField = useCallback(() => {
    cancelMigrationSearchDebounce()
    setState((prev) => {
      const q = prev.searchQuery.trim()
      const searchResults = q ? filterAndRankStationsFreeText(prev.searchQuery) : []
      return {
        ...prev,
        searchByField: null,
        searchResults
      }
    })
  }, [cancelMigrationSearchDebounce, filterAndRankStationsFreeText])

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

  if (firebaseLoading) {
    return (
      <div className="migration-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading data from Cloud Database...</p>
        </div>
      </div>
    )
  }

  // Full-page station search (URL has ?search=1&matchIndex=N) — layout aligned with station details pages
  if (isSearchPageMode && state.selectedMatchIndex !== null) {
    const fileLocation = formatStationLocationDisplay({
      county: selectedMatch?.oldStation.county,
      country: selectedMatch?.oldStation.country
    })
    const fileOperator = (selectedMatch?.oldStation.operator || '').trim()
    return (
      <div className="container container--station-details migration-station-search">
        <div className="station-details-page">
          <header className="station-details-header">
            <div>
              <h1 className="station-details-title">Match row to a station</h1>
              <div className="station-details-subtitle">
                <span>{selectedMatch?.oldStation.stationName || 'CSV row'}</span>
                {fileLocation ? (
                  <>
                    <span className="station-details-dot" aria-hidden>
                      ·
                    </span>
                    <span>{fileLocation}</span>
                  </>
                ) : null}
                <span className="station-details-dot" aria-hidden>
                  ·
                </span>
                <span>Choose the correct database station below</span>
              </div>
            </div>
            <div className="station-details-header-right" aria-hidden />
          </header>

          <div className="station-details-layout">
            <aside className="station-details-sidebar">
              <div className="station-details-sidebar-actions">
                <Button type="button" variant="wide" width="hug" onClick={() => handleCloseSearchModal()}>
                  Back to migration
                </Button>
                <div className="station-details-sidebar-actions-spacer" aria-hidden />
              </div>

              <section className="station-details-card modal-content migration-station-search-sidebar-card">
                <div className="modal-body">
                  <section className="modal-section">
                    <h3 className="modal-section-title">From your file</h3>
                    <div className="modal-details-grid">
                      <div className="modal-detail-item">
                        <span className="modal-detail-label">Station name</span>
                        <span className="modal-detail-value">{selectedMatch?.oldStation.stationName || '—'}</span>
                      </div>
                      <div className="modal-detail-item">
                        <span className="modal-detail-label">Location</span>
                        <span className="modal-detail-value">{fileLocation || '—'}</span>
                      </div>
                      {fileOperator ? (
                        <div className="modal-detail-item">
                          <span className="modal-detail-label">Operator (TOC)</span>
                          <span className="modal-detail-value">{fileOperator}</span>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>
              </section>
            </aside>

            <main className="station-details-main">
              <section className="station-details-card modal-content migration-station-search-main-card">
                <div className="modal-body">
                  <section className="modal-section migration-station-search-combined-section">
                    <h3 className="modal-section-title">Find a station</h3>
                    <p className="migration-station-search-hint migration-station-search-hint--toolbar">
                      Matches <strong>name</strong>, <strong>CRS</strong>, <strong>TIPLOC</strong>, and location; every word must
                      appear somewhere on the station. Text in parentheses like <strong>(Leeds)</strong> is ignored for matching.
                      Results update as you type — <kbd className="migration-station-search-kbd">Enter</kbd> runs search
                      immediately.
                    </p>
                    <div
                      className="migration-station-search-hstack"
                      role="group"
                      aria-label="Quick fill and field filters"
                    >
                      <div className="migration-station-search-hstack-col migration-station-search-hstack-col--quick">
                        <span className="migration-station-search-toolbar-label" id="migration-quick-fill-label">
                          Quick fill
                        </span>
                        <div
                          className="migration-station-search-chip-row migration-station-search-chip-row--toolbar"
                          aria-labelledby="migration-quick-fill-label"
                        >
                          <Button
                            type="button"
                            variant="chip"
                            width="hug"
                            onClick={() => handleSearchStations(selectedMatch?.oldStation.stationName || '')}
                          >
                            Station name
                          </Button>
                          {selectedMatch?.oldStation.county ? (
                            <Button
                              type="button"
                              variant="chip"
                              width="hug"
                              onClick={() =>
                                handleSearchStations(
                                  `${selectedMatch.oldStation.stationName} ${selectedMatch.oldStation.county}`
                                )
                              }
                            >
                              Name + county
                            </Button>
                          ) : null}
                          {selectedMatch?.oldStation.country ? (
                            <Button
                              type="button"
                              variant="chip"
                              width="hug"
                              onClick={() =>
                                handleSearchStations(
                                  `${selectedMatch.oldStation.stationName} ${selectedMatch.oldStation.country}`
                                )
                              }
                            >
                              Name + country
                            </Button>
                          ) : null}
                          {selectedMatch?.suggestedCrsCode ? (
                            <Button
                              type="button"
                              variant="chip"
                              width="hug"
                              onClick={() => handleSearchStations(selectedMatch.suggestedCrsCode)}
                            >
                              Suggested CRS
                            </Button>
                          ) : null}
                          {selectedMatch?.suggestedTiploc ? (
                            <Button
                              type="button"
                              variant="chip"
                              width="hug"
                              onClick={() => handleSearchStations(selectedMatch.suggestedTiploc)}
                            >
                              Suggested TIPLOC
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="migration-station-search-hstack-col migration-station-search-hstack-col--filters">
                        <span className="migration-station-search-toolbar-label" id="migration-field-filters-label">
                          Narrow to one field
                        </span>
                        <div
                          className="migration-station-search-by-wrap migration-station-search-by-wrap--toolbar"
                          aria-labelledby="migration-field-filters-label"
                        >
                          <div className="migration-station-search-by-buttons" aria-label="Search by field only">
                            <Button
                              type="button"
                              variant="chip"
                              width="hug"
                              disabled={state.searchByField === 'identifiers'}
                              onClick={() => handleSearchByField('identifiers', '')}
                              title="Match the CSV station name, or use the search box for CRS (first 3 characters) or TIPLOC (2+ characters)"
                            >
                              Name, CRS &amp; TIPLOC
                            </Button>
                            {selectedMatch?.oldStation.county ? (
                              <Button
                                type="button"
                                variant="chip"
                                width="hug"
                                disabled={state.searchByField === 'county'}
                                onClick={() => handleSearchByField('county', selectedMatch.oldStation.county)}
                              >
                                County
                              </Button>
                            ) : null}
                            {selectedMatch?.oldStation.country ? (
                              <Button
                                type="button"
                                variant="chip"
                                width="hug"
                                disabled={state.searchByField === 'country'}
                                onClick={() => handleSearchByField('country', selectedMatch.oldStation.country)}
                              >
                                Country
                              </Button>
                            ) : null}
                          </div>
                          {state.searchByField !== null ? (
                            <Button
                              type="button"
                              variant="circle"
                              ariaLabel="Remove search-by filter"
                              onClick={(e) => {
                                e.preventDefault()
                                handleClearSearchByField()
                              }}
                            >
                              ×
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="migration-station-search-bar-block">
                      <label htmlFor="migration-search-field-page" className="migration-station-search-label">
                        Search
                      </label>
                      <div className="migration-station-search-input-row">
                        <input
                          id="migration-search-field-page"
                          type="text"
                          placeholder="Try a name, code, or place…"
                          value={state.searchQuery}
                          onChange={(e) => handleMigrationSearchInputChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSearchStations(state.searchQuery)
                            }
                          }}
                          className="migration-station-search-field"
                          autoFocus
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="modal-section">
                    <h3 className="modal-section-title">Results</h3>
                    {state.searchResults.length > 0 ? (
                      <p className="migration-station-search-results-count" aria-live="polite">
                        {state.searchResults.length === MIGRATION_SEARCH_MAX_RESULTS
                          ? `${MIGRATION_SEARCH_MAX_RESULTS} matches (max shown — refine your search if needed)`
                          : `${state.searchResults.length} match${state.searchResults.length === 1 ? '' : 'es'}`}
                      </p>
                    ) : null}
                    <div className="migration-station-search-results">
                      {state.searchResults.length > 0 ? (
                        <ul className="migration-station-search-results-list" role="list">
                          {state.searchResults.map((station, index) => (
                            <li key={`${station.id ?? station.crsCode ?? index}-${index}`}>
                              <BUTSharedNativeButton
                                type="button"
                                className="migration-station-search-result-button"
                                onClick={() => {
                                  handleSelectStation(state.selectedMatchIndex!, station)
                                  if (isSearchPageMode) setSearchParams({}, { replace: true })
                                }}
                              >
                                <span className="migration-station-search-result-name">
                                  {station.stationName || station.stationname || 'Station'}
                                </span>
                                <div className="modal-details-grid migration-station-search-result-meta">
                                  <div className="modal-detail-item">
                                    <span className="modal-detail-label">CRS</span>
                                    <span className="modal-detail-value">
                                      {station.crsCode || station.CrsCode || '—'}
                                    </span>
                                  </div>
                                  <div className="modal-detail-item">
                                    <span className="modal-detail-label">TIPLOC</span>
                                    <span className="modal-detail-value">{station.tiploc || '—'}</span>
                                  </div>
                                  <div className="modal-detail-item migration-station-search-result-location">
                                    <span className="modal-detail-label">Location</span>
                                    <span className="modal-detail-value">
                                      {formatStationLocationDisplay({
                                        county: station.county,
                                        country: station.country,
                                        londonBorough: station.londonBorough
                                      }) || '—'}
                                    </span>
                                  </div>
                                </div>
                              </BUTSharedNativeButton>
                            </li>
                          ))}
                        </ul>
                      ) : state.searchQuery || state.searchByField !== null ? (
                        <p className="migration-station-search-empty" role="status">
                          No stations found. Try another search or filter.
                        </p>
                      ) : (
                        <p className="migration-station-search-empty migration-station-search-empty--hint" role="status">
                          Use <strong>Quick fill</strong> or type in the search box, or narrow with a field filter below.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </section>
            </main>
          </div>
        </div>
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
              database station, then continue to <strong>check duplicates</strong> when you’re ready.
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
                            <div key={index} className={rankMatchCardClassName(match)}>
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
                            <div key={index} className={rankMatchCardClassName(match)}>
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
                      <div
                        key={index}
                        className={rankMatchCardClassName(match, isCorrected ? 'rank-match-corrected' : undefined)}
                      >
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
              Check duplicates
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Duplicates — layout aligned with Step 3 (review) */}
      {state.step === 'duplicates' && state.result && (
        <div className="migration-step review-step duplicates-step">
          <header className="mapping-step-header review-step-header">
            <span className="mapping-step-eyebrow">Step 4 of 6</span>
            <h2 className="mapping-step-title">Check duplicates</h2>
            <p className="mapping-step-lead">
              <strong>Check duplicates</strong> in the <strong>Matched in database</strong> column: if the same station appears on more
              than one row, one of them is probably wrong. Use <strong>Correct</strong> on each line that needs fixing, then continue to
              the summary when you’re ready.
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
                Same overview as review — counts stay in sync after corrections. Open each group below to finish your duplicate check
                when the same matched station still appears on more than one row.
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
                <h3 id="duplicate-ids-heading" className="review-subsection-title">Check duplicates</h3>
                <p className="review-subsection-desc">
                  Each group is a duplicate check: the same station shows in <strong>Matched in database</strong> on more than one row.
                  Use <strong>Correct</strong> so each line points at the right place.
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
                  const duplicateSummaryText = `Duplicate ${gIdx + 1}`
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
                        <span className="duplicate-group-title">{duplicateSummaryText}</span>
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
                    {indicesInRange.length === 0 ? (
                      <div className="rank-matches duplicate-group-rank-matches duplicate-group-rank-matches--resolved">
                        <p className="duplicate-group-all-resolved">All set — each row now has its own matched station on the right.</p>
                      </div>
                    ) : (
                      <div className="confidence-rank amber duplicate-group-confidence">
                        <div className="rank-matches">
                      {indicesInRange.map((matchIndex) => {
                        const match = state.result!.matches[matchIndex]
                        const fb = match.firebaseStation
                        const isCorrected = match.matchType === 'manual'
                        const showConfidence = match.matchType === 'fuzzy' && match.confidence != null
                        return (
                          <div
                            key={matchIndex}
                            className={rankMatchCardClassName(match, isCorrected ? 'rank-match-corrected' : undefined)}
                          >
                            {showConfidence ? (
                              <span className="match-confidence">{(match.confidence! * 100).toFixed(1)}%</span>
                            ) : (
                              <span className="match-confidence match-confidence--placeholder" aria-hidden="true">
                                —
                              </span>
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
                      </div>
                    )}
                  </details>
                  )
                })
              })()}
            </section>
          ) : (
            <div className="review-subsection duplicates-step-empty" role="status">
              <p className="duplicates-step-empty-message">
                Duplicate check: nothing to fix — each row has a different matched station on the right.
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
              <div className="confidence-rank red mismatched-step-confidence">
                <div className="rank-matches">
                {state.result.mismatchedMatchIndices.map((matchIndex) => {
                  const match = state.result!.matches[matchIndex]
                  const fb = match.firebaseStation
                  const showConfidence = match.matchType === 'fuzzy' && match.confidence != null
                  const isCorrected = match.matchType === 'manual'
                  return (
                    <div
                      key={matchIndex}
                      className={rankMatchCardClassName(match, isCorrected ? 'rank-match-corrected' : undefined)}
                    >
                      {showConfidence ? (
                        <span className="match-confidence">{(match.confidence! * 100).toFixed(1)}%</span>
                      ) : (
                        <span className="match-confidence match-confidence--placeholder" aria-hidden="true">
                          —
                        </span>
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
              </div>
            </section>
          )}
          <div className="mapping-actions mapping-actions--bottom review-step-footer-actions">
            <Button type="button" onClick={handleBackToReview} variant="wide" width="hug">
              Back to review
            </Button>
            <Button type="button" onClick={handleContinueToSummary} variant="wide" width="hug">
              Review changes
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
                        Check duplicates <span className="correction-log-count">({duplicateCorrections.length})</span>
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
                Back to check duplicates
              </Button>
              <Button type="button" onClick={handleContinueToComplete} variant="wide" width="hug">
                Continue to summary
              </Button>
            </div>
          </div>
        )
      })()}

      {/* Step 6: Migration complete (same shell as other steps) */}
      {state.step === 'complete' && state.result && (
        <div className="migration-step review-step migration-complete-step">
          <header className="mapping-step-header review-step-header">
            <span className="mapping-step-eyebrow">Step 6 of 6</span>
            <h2 className="mapping-step-title">Migration complete</h2>
            <p className="mapping-step-lead">
              Your file is ready. Review how to import below, then download the CSV and add it in the Rail Statistics app.
            </p>
          </header>

          <div className="migration-complete-body">
            <section className="review-subsection migration-complete-panel" aria-labelledby="migration-app-heading">
              <div className="review-subsection-head">
                <h3 id="migration-app-heading" className="review-subsection-title">
                  Import in the Rail Statistics app
                </h3>
                <p className="review-subsection-desc">
                  You have <strong>successfully migrated</strong> your stations. Re-open the <strong>Rail Statistics</strong> app and
                  import your stations using the CSV you download in the next section.
                </p>
              </div>
            </section>

            <section className="review-subsection migration-complete-panel" aria-labelledby="migration-download-heading">
              <div className="review-subsection-head">
                <h3 id="migration-download-heading" className="review-subsection-title">
                  Download your migrated file
                </h3>
                <p className="review-subsection-desc">
                  Save this CSV to your device. You&apos;ll use it in the app as described above.
                </p>
              </div>
              <div className="migration-complete-download-actions">
                <Button
                  onClick={handleDownload}
                  variant="wide"
                  width="hug"
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  }
                ariaLabel={`Download converted stations CSV (${getGbStationsDownloadFilename()})`}
              >
                Download
              </Button>
              </div>
            </section>

            {state.result.newStations && state.result.newStations.length > 0 && (
            <details className="migration-complete-details migration-complete-new-stations-details">
              <summary className="migration-complete-details-summary">
                <span className="migration-complete-details-summary-main">
                  <span className="migration-complete-details-summary-title">
                    New stations in your file ({state.result.newStations.length})
                  </span>
                  <span className="migration-complete-details-summary-hint">
                    Rows added from the cloud database (ID 2588+)
                  </span>
                </span>
                <MigrationCompleteDetailsChevron />
              </summary>
              <div className="migration-complete-details-inner">
                <p className="migration-complete-new-stations-desc">
                  These stations (ID 2588+) were added to your CSV from the cloud database.
                </p>
                <div className="migration-complete-table-shell migration-complete-new-stations-shell">
                  <table className="migration-complete-data-table migration-complete-new-stations-table">
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
            </details>
          )}

          <details className="migration-complete-details migration-complete-stats-details">
            <summary className="migration-complete-details-summary">
              <span className="migration-complete-details-summary-main">
                <span className="migration-complete-details-summary-title">Migration summary</span>
                <span className="migration-complete-details-summary-hint">
                  Totals, match counts, duplicates, and corrections from this run
                </span>
              </span>
              <MigrationCompleteDetailsChevron />
            </summary>
            <div className="migration-complete-details-inner">
              <MigrationCompleteSummaryBody
                stats={state.result.stats}
                correctionsCount={state.correctionsCount ?? 0}
              />
            </div>
          </details>
          </div>

          {/* Action Buttons */}
          <div className="mapping-actions mapping-actions--bottom review-step-footer-actions">
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

