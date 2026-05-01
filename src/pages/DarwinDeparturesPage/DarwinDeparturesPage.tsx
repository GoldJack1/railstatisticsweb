import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDepartures } from '../../hooks/useDepartures'
import type { DepartureRow, DepartureServiceType } from '../../types/darwin'
import type { Station } from '../../types'
import { useStations } from '../../hooks/useStations'
import { PageTopHeader } from '../../components/misc'
import { BUTBaseButton, BUTWideButton } from '../../components/buttons'
import BUTDDMList from '../../components/buttons/ddm/BUTDDMList'
import BUTDDMListActionDual from '../../components/buttons/ddm/BUTDDMListActionDual'
import { TextCard } from '../../components/cards'
import TXTINPBUTIconWideButtonSearch from '../../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'
import { StationMessages } from '../../components/darwin/StationMessages'
import './DarwinDeparturesPage.css'

interface HistoryDatesResponse {
  count: number
  dates: Array<{
    date: string
    hasState: boolean
    hasTimetable: boolean
    snapshots?: string[]
  }>
}

const WINDOW_OPTIONS = [
  { label: '1 hour',   value: 1 },
  { label: '3 hours',  value: 3 },
  { label: '6 hours',  value: 6 },
  { label: '12 hours', value: 12 },
]
const WINDOW_VALUES = new Set(WINDOW_OPTIONS.map((opt) => opt.value))

const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="7" cy="7" r="4" />
    <line x1="11" y1="11" x2="13" y2="13" />
  </svg>
)

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London',
  })
}

function formatAge(ms: number | null): string {
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

function formatHeaderDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatLiveNowUk(): string {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  })
}

function getLiveNowPartsUk(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value || '00'
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    time: `${pick('hour')}:${pick('minute')}`,
  }
}

function normalizeTimeInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return ''
  // Accept HHMM (e.g. 0920) or HMM (e.g. 920)
  if (/^\d{3,4}$/.test(t)) {
    const padded = t.padStart(4, '0')
    const hh = Number(padded.slice(0, 2))
    const mm = Number(padded.slice(2, 4))
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    return null
  }
  // Accept HH:MM
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const hh = Number(m[1]); const mm = Number(m[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function getCurrentRailwayDayIsoUk(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value || '00'

  const year = Number(pick('year'))
  const month = Number(pick('month'))
  const day = Number(pick('day'))
  const hour = Number(pick('hour'))
  const minute = Number(pick('minute'))

  const londonAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  const railwayDayUtc = londonAsUtc - ((4 * 60 + 30) * 60 * 1000)
  return new Date(railwayDayUtc).toISOString().slice(0, 10)
}

function addDaysIsoDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return dateStr
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Compact pill rendered as the trailing element of each TextCard, replacing
 * the default chevron. Conveys live status at a glance.
 */
const StatusBadge: React.FC<{ row: DepartureRow; historicalMode: boolean }> = ({ row, historicalMode }) => {
  let cls = 'dep-badge'
  let text = 'On time'
  if (row.cancelled) {
    cls += ' dep-badge--cancelled'
    text = 'Cancelled'
  } else if (historicalMode && (row.liveKind === 'scheduled' || row.liveKind === 'working')) {
    // Historical snapshots often have no meaningful live event at that minute.
    // Show a neutral marker instead of implying the service is "on time now".
    text = 'Snapshot'
  } else if (row.liveKind === 'actual') {
    cls += ' dep-badge--actual'
    text = `Departed ${row.liveTime}`
  } else if (row.liveKind === 'actual-arr') {
    cls += ' dep-badge--actual'
    text = `Arrived ${row.liveTime}`
  } else if (row.liveKind === 'est' && row.liveTime !== row.scheduledTime) {
    cls += ' dep-badge--late'
    text = `Exp ${row.liveTime}`
  } else if (row.liveKind === 'est-arr') {
    text = `Exp arr ${row.liveTime}`
  } else {
    cls += ' dep-badge--ontime'
  }
  return <span className={cls}>{text}</span>
}

/** Build the description string for a TextCard from a departure row. */
function buildDescription(row: DepartureRow): string {
  const platform = row.livePlatform || row.platform
  const platLabel = platform ? `Plat ${platform}` : 'No platform'
  const toc = row.tocName || row.toc
  const headcode = row.trainId
  const fromOrigin = row.originName ? `from ${row.originName}` : null

  if (row.cancelled && row.cancellation) {
    // Some feeds report generic "schedule deactivated", which is confusing
    // to passengers; show a clean cancellation label instead.
    if (isScheduleDeactivatedReason(row.cancellation.reason)) return 'Cancelled'
    const code = row.cancellation.code ? ` (code ${row.cancellation.code})` : ''
    return `Cancelled — ${row.cancellation.reason}${code}`
  }
  if (!row.cancelled && row.delayReason) {
    const code = row.delayReason.code ? ` (code ${row.delayReason.code})` : ''
    return `Delay reason: ${row.delayReason.reason}${code}`
  }
  return [platLabel, toc, headcode, fromOrigin].filter(Boolean).join(' · ')
}

/** Build the title string. */
function buildTitle(row: DepartureRow): string {
  const time = formatTime(row.scheduledAt)
  const dest = row.destinationName || row.destination
  return `${time} · ${dest}`
}

function normalizeStationText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-_,.]+/g, ' ')
}

function isScheduleDeactivatedReason(reason?: string | null): boolean {
  if (!reason) return false
  return reason.trim().toLowerCase().includes('schedule deactivated')
}

function resolveSearchInput(rawInput: string, stations: Station[]): string | null {
  const trimmed = rawInput.trim()
  if (!trimmed) return null

  const directCode = trimmed.toUpperCase()
  const byCode = stations.find((station) => {
    const crs = station.crsCode?.toUpperCase()
    const tiploc = station.tiploc?.toUpperCase()
    return crs === directCode || tiploc === directCode
  })
  if (byCode) return byCode.crsCode || byCode.tiploc

  const normalizedInput = normalizeStationText(trimmed)
  const withNormalizedName = stations
    .filter((station) => station.stationName)
    .map((station) => ({
      station,
      normalizedName: normalizeStationText(station.stationName),
    }))

  const exactNameMatch = withNormalizedName.find((item) => item.normalizedName === normalizedInput)
  if (exactNameMatch) return exactNameMatch.station.crsCode || exactNameMatch.station.tiploc

  const startsWithMatch = withNormalizedName.find((item) => item.normalizedName.startsWith(normalizedInput))
  if (startsWithMatch) return startsWithMatch.station.crsCode || startsWithMatch.station.tiploc

  const includesMatch = withNormalizedName.find((item) => item.normalizedName.includes(normalizedInput))
  if (includesMatch) return includesMatch.station.crsCode || includesMatch.station.tiploc

  return null
}

const SERVICE_TYPE_LABELS: Record<DepartureServiceType, string> = {
  passenger: 'Passenger',
  freight: 'Freight',
  'rail-replacement': 'Rail replacement',
  other: 'Other',
}

function buildStationNameSearchResults(rawInput: string, stations: Station[]): Station[] {
  const normalizedInput = normalizeStationText(rawInput)
  if (normalizedInput.length < 2) return []

  const candidates = stations
    .filter((station) => Boolean(station.stationName))
    .map((station) => ({
      station,
      normalizedName: normalizeStationText(station.stationName),
    }))
    .filter((item) => item.normalizedName.includes(normalizedInput))

  const exact = candidates.filter((item) => item.normalizedName === normalizedInput)
  const starts = candidates.filter((item) => item.normalizedName.startsWith(normalizedInput) && item.normalizedName !== normalizedInput)
  const includes = candidates.filter((item) => !item.normalizedName.startsWith(normalizedInput))

  return [...exact, ...starts, ...includes].slice(0, 8).map((item) => item.station)
}

const DarwinDeparturesPage: React.FC = () => {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const code = params.code?.toUpperCase() || ''
  const hasStationSelected = code.length > 0
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [historyDateError, setHistoryDateError] = useState<string | null>(null)
  const [selectedTocs, setSelectedTocs] = useState<string[]>([])
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<DepartureServiceType[]>([])
  const [historyDates, setHistoryDates] = useState<string[]>([])
  const { stations } = useStations()

  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const historyDate = query.get('date') || ''
  const historyTime = query.get('at') || ''
  const initialLiveNow = useMemo(() => getLiveNowPartsUk(), [])
  const [historyDateDraft, setHistoryDateDraft] = useState<string>(historyDate || initialLiveNow.date)
  const [historyTimeDraft, setHistoryTimeDraft] = useState<string>(historyTime || initialLiveNow.time)
  const todayIsoDate = useMemo(() => getCurrentRailwayDayIsoUk(), [])
  const maxFutureDateIso = useMemo(() => addDaysIsoDate(todayIsoDate, 2), [todayIsoDate])
  const hoursFromQuery = Number(query.get('hours') || WINDOW_OPTIONS[0].value)
  const hours = WINDOW_VALUES.has(hoursFromQuery) ? hoursFromQuery : WINDOW_OPTIONS[0].value
  const historicalMode = Boolean(historyDate && (historyDate < todayIsoDate || Boolean(historyTime)))
  const futureTimetableMode = Boolean(historyDate && historyDate > todayIsoDate)

  useEffect(() => {
    if (historyDate) setHistoryDateDraft(historyDate)
    if (historyTime) setHistoryTimeDraft(historyTime)
    if (!historyDate && !historyTime) {
      const now = getLiveNowPartsUk()
      setHistoryDateDraft(now.date)
      setHistoryTimeDraft(now.time)
    }
  }, [historyDate, historyTime])

  const updateQuery = (updater: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(location.search)
    updater(next)
    navigate(
      {
        pathname: location.pathname,
        search: next.toString() ? `?${next.toString()}` : '',
      },
      { replace: true }
    )
  }

  const { status, data, error, ageMs, refetch } = useDepartures({
    code: hasStationSelected ? code : '',
    hours,
    date: historyDate || undefined,
    at: historyDate && historyTime ? historyTime : undefined,
  })

  useEffect(() => {
    setSearchInput('')
    setSearchError(null)
  }, [code])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/darwin/history/dates')
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const body: HistoryDatesResponse = await res.json()
        if (cancelled) return
        const dates = (body.dates || [])
          .filter((d) => d.hasState && d.hasTimetable)
          .map((d) => d.date)
          .sort((a, b) => b.localeCompare(a))
        setHistoryDates(dates)
      } catch (e) {
        if (cancelled) return
        setHistoryDates([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const submitSearch = () => {
    const next = resolveSearchInput(searchInput, stations)
    if (!next) {
      setSearchError('No station match found. Try station name, CRS, or TIPLOC.')
      return
    }
    const normalizedNext = next.toUpperCase()
    if (normalizedNext === code) return
    setSearchError(null)
    navigate(`/departures/${normalizedNext}${location.search}`)
  }

  const stationLabel = useMemo(() => {
    if (!hasStationSelected) return 'Live departures'
    if (data?.stationName) {
      return data.stationCrs ? `${data.stationName} (${data.stationCrs})` : data.stationName
    }
    return code
  }, [code, data, hasStationSelected])

  const windowSelectedIndex = useMemo(() => {
    const idx = WINDOW_OPTIONS.findIndex((opt) => opt.value === hours)
    return idx >= 0 ? idx : 0
  }, [hours])

  const tocOptions = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.departures.map((row) => row.tocName || row.toc).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [data])

  const serviceTypeOptions = useMemo(() => {
    if (!data) return []
    const inFeedOrder = data.departures
      .map((row) => row.serviceType || 'other')
      .filter((value, index, arr): value is DepartureServiceType => arr.indexOf(value) === index)
    return inFeedOrder.sort((a, b) => SERVICE_TYPE_LABELS[a].localeCompare(SERVICE_TYPE_LABELS[b]))
  }, [data])

  useEffect(() => {
    setSelectedTocs(tocOptions)
  }, [tocOptions])

  useEffect(() => {
    setSelectedServiceTypes(serviceTypeOptions)
  }, [serviceTypeOptions])

  const filteredDepartures = useMemo(() => {
    if (!data) return []
    return data.departures.filter((row) => {
      const tocLabel = row.tocName || row.toc
      const tocMatch = selectedTocs.includes(tocLabel)
      const rowServiceType = row.serviceType || 'other'
      const serviceTypeMatch = selectedServiceTypes.includes(rowServiceType)
      return tocMatch && serviceTypeMatch
    })
  }, [data, selectedTocs, selectedServiceTypes])

  const filteredCounts = useMemo(() => ({
    departures: filteredDepartures.length,
    cancelled: filteredDepartures.filter((row) => row.cancelled).length,
    withDelay: filteredDepartures.filter((row) => row.delayReason).length,
  }), [filteredDepartures])

  const subtitle = useMemo<React.ReactNode>(() => {
    const countPrefix = data
      ? `${filteredCounts.departures} departures in the next ${data.windowHours} hour${data.windowHours === 1 ? '' : 's'}`
      : null

    if (!hasStationSelected) return 'Search by station name, CRS, or TIPLOC'
    const boardDate = historyDate || todayIsoDate
    const boardDateText = `Board date: ${formatHeaderDate(boardDate)}${historicalMode ? ' (historical)' : futureTimetableMode ? ' (timetable)' : ''}`
    const liveNowText = historicalMode || futureTimetableMode ? null : `Live now: ${formatLiveNowUk()}`

    if (status === 'ok') {
      const statusText = historicalMode
        ? `Historical snapshot${historyTime ? ` at ${historyTime}` : ' (latest for selected date)'}`
        : futureTimetableMode
          ? `Timetable view${historyTime ? ` at ${historyTime}` : ' for selected date'}`
        : `Live board · auto-refreshing · updated ${formatAge(ageMs)}`
      return countPrefix ? (
        <>
          <span className="dep-subtitle__count">{countPrefix}</span>
          {'\n'}
          <span className="dep-subtitle__status">{statusText}</span>
          {'\n'}
          <span className="dep-subtitle__status">{boardDateText}</span>
          {liveNowText ? (
            <>
              {'\n'}
              <span className="dep-subtitle__status">{liveNowText}</span>
            </>
          ) : null}
        </>
      ) : <span className="dep-subtitle__status">{statusText}</span>
    }
    if (status === 'stale') {
      const statusText = historicalMode
        ? `Historical snapshot${historyTime ? ` at ${historyTime}` : ' (latest for selected date)'}`
        : futureTimetableMode
          ? `Timetable view${historyTime ? ` at ${historyTime}` : ' for selected date'}`
        : `Stale live board · ${formatAge(ageMs)}`
      return countPrefix ? (
        <>
          <span className="dep-subtitle__count">{countPrefix}</span>
          {'\n'}
          <span className="dep-subtitle__status">{statusText}</span>
          {'\n'}
          <span className="dep-subtitle__status">{boardDateText}</span>
          {liveNowText ? (
            <>
              {'\n'}
              <span className="dep-subtitle__status">{liveNowText}</span>
            </>
          ) : null}
        </>
      ) : <span className="dep-subtitle__status">{statusText}</span>
    }
    if (status === 'loading')   return <span className="dep-subtitle__status">Loading departures for {boardDateText.toLowerCase()}…</span>
    if (status === 'error')     return <span className="dep-subtitle__status">{error ? `Error: ${error}` : 'Departures unavailable'} · {boardDateText}</span>
    if (status === 'not-found') return <span className="dep-subtitle__status">Unknown station</span>
    return ''
  }, [status, error, ageMs, hasStationSelected, data, filteredCounts.departures, historicalMode, historyDate, historyTime, futureTimetableMode, todayIsoDate])

  const stationNameResults = useMemo(
    () => buildStationNameSearchResults(searchInput, stations),
    [searchInput, stations]
  )

  const boardDateLabel = useMemo(() => {
    const boardDate = historyDate || todayIsoDate
    return `${formatHeaderDate(boardDate)}${historicalMode ? ' (historical)' : futureTimetableMode ? ' (timetable)' : ''}`
  }, [historicalMode, historyDate, futureTimetableMode, todayIsoDate])

  const showStationNameResults = useMemo(() => {
    const trimmed = searchInput.trim()
    if (trimmed.length < 2) return false
    if (trimmed === trimmed.toUpperCase() && trimmed.length <= 7) return false
    return stationNameResults.length > 0
  }, [searchInput, stationNameResults])

  const availableHistoryDatesSet = useMemo(() => new Set(historyDates), [historyDates])

  const applyDateTimeFilter = () => {
    const dateValue = historyDateDraft.trim()
    const normalizedTime = normalizeTimeInput(historyTimeDraft)
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    const timeOk = normalizedTime !== null
    if (!dateOk) {
      setHistoryDateError('Use date format YYYY-MM-DD.')
      return
    }
    if (!timeOk) {
      setHistoryDateError('Use time format HH:MM, 0920, or 920.')
      return
    }
    if (dateValue > maxFutureDateIso) {
      setHistoryDateError(`Future timetable view currently supports up to ${formatHeaderDate(maxFutureDateIso)}.`)
      return
    }
    if (dateValue < todayIsoDate && historyDates.length > 0 && !availableHistoryDatesSet.has(dateValue)) {
      setHistoryDateError('That date is not available in historical snapshots.')
      return
    }
    setHistoryDateError(null)
    updateQuery((next) => {
      next.set('date', dateValue)
      if (normalizedTime) next.set('at', normalizedTime)
      else next.delete('at')
    })
  }

  const resetToLiveNow = () => {
    const now = getLiveNowPartsUk()
    setHistoryDateDraft(now.date)
    setHistoryTimeDraft(now.time)
    setHistoryDateError(null)
    updateQuery((next) => {
      next.delete('date')
      next.delete('at')
    })
  }

  return (
    <div className="darwin-departures-shell">
      <PageTopHeader
        title={stationLabel}
        subtitle={subtitle}
        className={`darwin-departures-header darwin-departures-header--${status}`}
      />

      <div className="darwin-departures-page">
        <div className="dep-content">
          <aside className="dep-sidebar" aria-label="Departure controls">
            <section className="dep-controls-panel dep-sidebar-section" aria-label="Filters">
              <div className="dep-date-context" role="status" aria-live="polite">
                <span><strong>Board date:</strong> {boardDateLabel}</span>
                <span><strong>Live now:</strong> {formatLiveNowUk()}</span>
              </div>
              <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">Search</h2>
              <div className="dep-control-group">
                <div className="dep-search-row">
                  <TXTINPBUTIconWideButtonSearch
                    id="darwin-station-search"
                    icon={<SearchIcon />}
                    value={searchInput}
                    onChange={(value) => {
                      setSearchInput(value)
                      if (searchError) setSearchError(null)
                    }}
                    onSubmit={submitSearch}
                    enterKeyHint="search"
                    placeholder="Station name, CRS or TIPLOC e.g. Leeds, KGX, LEEDS"
                    className="dep-search-input"
                    colorVariant="primary"
                  />
                </div>
                {showStationNameResults && (
                  <div className="dep-search-results" role="listbox" aria-label="Station matches">
                    {stationNameResults.map((station) => {
                      const isFirst = stationNameResults[0]?.id === station.id
                      const isLast = stationNameResults[stationNameResults.length - 1]?.id === station.id
                      const buttonShape = isFirst ? 'top-rounded' : isLast ? 'bottom-rounded' : 'squared'
                      const targetCode = (station.crsCode || station.tiploc || '').toUpperCase()
                      const targetLabel = station.crsCode
                        ? `${station.stationName} (${station.crsCode.toUpperCase()})`
                        : `${station.stationName} (${(station.tiploc || '').toUpperCase()})`

                      return (
                        <BUTBaseButton
                          key={station.id}
                          variant="wide"
                          shape={buttonShape}
                          width="fill"
                          className="dep-search-result-item-button"
                          instantAction
                          aria-label={`Open departures for ${targetLabel}`}
                          onClick={() => {
                            if (!targetCode) return
                            setSearchError(null)
                            setSearchInput('')
                            navigate(`/departures/${targetCode}${location.search}`)
                          }}
                        >
                          <span className="dep-search-result-name">{station.stationName}</span>
                          <span className="dep-search-result-code">
                            {station.crsCode?.toUpperCase() || '—'} · {(station.tiploc || '—').toUpperCase()}
                          </span>
                        </BUTBaseButton>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="dep-control-group">
                <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">Date and time</h2>
                <div className="dep-history-controls">
                  <div className="dep-history-field">
                    <span>Date (YYYY-MM-DD)</span>
                    <input
                      type="text"
                      value={historyDateDraft}
                      onChange={(e) => {
                        setHistoryDateDraft(e.target.value)
                        if (historyDateError) setHistoryDateError(null)
                      }}
                      placeholder={initialLiveNow.date}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="dep-history-field">
                    <span>Time (HH:MM)</span>
                    <input
                      type="text"
                      value={historyTimeDraft}
                      onChange={(e) => {
                        setHistoryTimeDraft(e.target.value)
                        if (historyDateError) setHistoryDateError(null)
                      }}
                      placeholder={initialLiveNow.time}
                      inputMode="numeric"
                    />
                  </div>
                  <BUTWideButton width="fill" instantAction colorVariant="primary" onClick={applyDateTimeFilter}>
                    Apply date/time
                  </BUTWideButton>
                  <BUTWideButton width="fill" instantAction colorVariant="primary" onClick={resetToLiveNow}>
                    Live now
                  </BUTWideButton>
                  {historyDateError && (
                    <p className="dep-history-inline-error" role="alert">{historyDateError}</p>
                  )}
                </div>
              </div>

              <div className="dep-search-filters-spacer" aria-hidden="true" />

              <div className="dep-control-group">
                <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">Window</h2>
                <BUTDDMList
                  items={WINDOW_OPTIONS.map((opt) => opt.label)}
                  filterName="Window"
                  selectionMode="single"
                  selectedPositions={[windowSelectedIndex]}
                  onSelectionChanged={(selectedPositions) => {
                    const idx = selectedPositions[0]
                    if (typeof idx !== 'number') return
                    const selectedOption = WINDOW_OPTIONS[idx]
                    if (!selectedOption) return
                    updateQuery((next) => {
                      next.set('hours', String(selectedOption.value))
                    })
                  }}
                  colorVariant="primary"
                />
              </div>

              <div className="dep-control-group">
                <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">TOC</h2>
                <BUTDDMListActionDual
                  items={tocOptions}
                  filterName="TOCs"
                  selectionMode="multi"
                  selectedPositions={selectedTocs
                    .map((toc) => tocOptions.indexOf(toc))
                    .filter((index) => index >= 0)}
                  onSelectionChanged={(_, selectedItems) => {
                    setSelectedTocs(selectedItems)
                  }}
                  colorVariant="primary"
                />
              </div>

              <div className="dep-control-group">
                <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">Service type</h2>
                <BUTDDMListActionDual
                  items={serviceTypeOptions.map((type) => SERVICE_TYPE_LABELS[type])}
                  filterName="Service types"
                  selectionMode="multi"
                  selectedPositions={selectedServiceTypes
                    .map((type) => serviceTypeOptions.indexOf(type))
                    .filter((index) => index >= 0)}
                  onSelectionChanged={(_, selectedItems) => {
                    const selected = selectedItems
                      .map((label) => serviceTypeOptions.find((type) => SERVICE_TYPE_LABELS[type] === label))
                      .filter((value): value is DepartureServiceType => Boolean(value))
                    setSelectedServiceTypes(selected)
                  }}
                  colorVariant="primary"
                />
              </div>

              <div className="dep-control-group dep-control-group--actions">
                <BUTWideButton
                  width="fill"
                  instantAction
                  colorVariant="primary"
                  onClick={refetch}
                  disabled={historicalMode && !historyDate}
                >
                  Refresh
                </BUTWideButton>
              </div>

              {searchError && (
                <p className="dep-state-card dep-state-card--error dep-state-card--compact" role="alert">{searchError}</p>
              )}

              {data && (
                <div className="dep-summary" role="status" aria-live="polite">
                  {filteredCounts.cancelled > 0 && (
                    <div className="dep-summary-stat dep-summary-stat--cancel">
                      <strong>{filteredCounts.cancelled}</strong><span>cancelled</span>
                    </div>
                  )}
                  {filteredCounts.withDelay > 0 && (
                    <div className="dep-summary-stat dep-summary-stat--delay">
                      <strong>{filteredCounts.withDelay}</strong><span>with delay reason</span>
                    </div>
                  )}
                  {data.alternates && data.alternates.length > 0 && (
                    <div className="dep-summary-stat dep-summary-stat--alt">
                      <span>also matches:</span>
                      <strong>{data.alternates.join(', ')}</strong>
                    </div>
                  )}
                </div>
              )}
            </section>

          </aside>

          <main className="dep-main">
            {!hasStationSelected && (
              <section className="dep-state-card">
                <h2>Choose a station to begin</h2>
                <p>
                  Enter a full station name (for example <code>Leeds</code>), a
                  3-letter CRS code (for example <code>LDS</code>), or a TIPLOC
                  (for example <code>LEEDS</code>).
                </p>
              </section>
            )}

            {hasStationSelected && status === 'not-found' && (
              <section className="dep-state-card dep-state-card--error">
                <h2>Station not found</h2>
                <p>
                  No station matches <code>{code}</code>. Try a station name, 3-letter CRS
                  (e.g. <code>KGX</code>, <code>LDS</code>) or a TIPLOC
                  (e.g. <code>LEEDS</code>, <code>KNGX</code>).
                </p>
              </section>
            )}

            {hasStationSelected && status === 'error' && !data && (
              <section className="dep-state-card dep-state-card--error">
                <h2>Departures unavailable</h2>
                <p>{error}</p>
              </section>
            )}

            {hasStationSelected && status === 'loading' && !data && (
              <section className="dep-state-card">
                <div className="dep-loading-state" role="status" aria-live="polite">
                  <span className="dep-loading-spinner" aria-hidden="true" />
                  <p>
                    {historicalMode
                      ? `Loading historical data${historyDate ? ` for ${formatHeaderDate(historyDate)}` : ''}…`
                      : futureTimetableMode
                        ? 'Loading timetable data…'
                        : 'Loading live departures…'}
                  </p>
                </div>
              </section>
            )}

            {data && (
              <>
                {/* NRCC operational warnings affecting this station, severity-sorted.
                 * Renders nothing when no messages are in flight. */}
                <StationMessages messages={data.messages || []} />

                {filteredDepartures.length === 0 ? (
                  <section className="dep-state-card">
                    <p>No departures match the selected filters in the next {data.windowHours} hour{data.windowHours === 1 ? '' : 's'}.</p>
                  </section>
                ) : (
                  <div className="dep-cards" role="list">
                    {filteredDepartures.map((row) => (
                      <div role="listitem" key={row.rid}>
                        <TextCard
                          title={buildTitle(row)}
                          description={buildDescription(row)}
                          state={row.cancelled ? 'redAction' : (row.hasConsist ? 'greenAction' : 'default')}
                          trailingIcon={<StatusBadge row={row} historicalMode={historicalMode} />}
                          onClick={() => {
                            const qp = new URLSearchParams()
                            if (historicalMode && historyDate) {
                              qp.set('date', historyDate)
                              if (historyTime) qp.set('at', historyTime)
                            }
                            const backQs = new URLSearchParams()
                            backQs.set('hours', String(hours))
                            if (historicalMode && historyDate) backQs.set('date', historyDate)
                            if (historicalMode && historyTime) backQs.set('at', historyTime)
                            const backTo = `/departures/${encodeURIComponent(code)}${backQs.toString() ? `?${backQs.toString()}` : ''}`
                            qp.set('from', backTo)
                            const suffix = qp.toString() ? `?${qp.toString()}` : ''
                            navigate(`/services/${encodeURIComponent(row.rid)}${suffix}`)
                          }}
                          ariaLabel={`View details for ${formatTime(row.scheduledAt)} to ${row.destinationName || row.destination}, ${row.cancelled ? 'cancelled' : (historicalMode ? 'historical snapshot' : 'on time')}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <footer className="dep-footer">
                  <span>Source: Network Rail Darwin Push Port</span>
                  <span className="dep-footer-sep" aria-hidden="true">·</span>
                  <span>Timetable: {data.timetableFile}</span>
                  <span className="dep-footer-sep" aria-hidden="true">·</span>
                  <span>Updated {new Date(data.updatedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</span>
                </footer>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default DarwinDeparturesPage
