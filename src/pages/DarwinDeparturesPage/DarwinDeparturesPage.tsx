import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDepartures } from '../../hooks/useDepartures'
import type { DepartureRow, DepartureServiceType } from '../../types/darwin'
import type { Station } from '../../types'
import { useStations } from '../../hooks/useStations'
import { PageTopHeader } from '../../components/misc'
import { BUTBaseButton, BUTOperatorChip, BUTWideButton } from '../../components/buttons'
import BUTDDMList from '../../components/buttons/ddm/BUTDDMList'
import BUTDDMListActionDual from '../../components/buttons/ddm/BUTDDMListActionDual'
import { TextCard } from '../../components/cards'
import TXTINPBUTIconWideButtonSearch from '../../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'
import { StationMessages } from '../../components/darwin/StationMessages'
import DataLicenceAttribution from '../../components/darwin/DataLicenceAttribution'
import { railwayOperatingDayIsoFromLondonParts } from '../../utils/railwayOperatingDayUk'
import { fetchDarwin } from '../../utils/darwinReadyFetch'
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

type StopModeFilter = 'calling' | 'passing'
type SearchMode = 'station-name' | 'crs' | 'tiploc'
type BoardModeFilter = 'departures' | 'arrivals'

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

function platformSourceLabel(src: string | null | undefined): string | null {
  if (!src) return null
  if (src === 'A') return 'auto'
  if (src === 'M') return 'manual'
  if (src === 'P') return 'planned'
  return src
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

  return railwayOperatingDayIsoFromLondonParts(year, month, day, hour, minute)
}

/** Operating-day key matching `railwayDayYmd` in departures-daemon (02:00 Europe/London). */
function railwayOperatingDayIsoUk(dateStr: string, timeHHMM: string): string {
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeHHMM.trim())
  if (!tm) return dateStr
  const h = Number(tm[1]); const mi = Number(tm[2])
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!dm || !Number.isFinite(h) || !Number.isFinite(mi)) return dateStr
  const y = Number(dm[1]); const mo = Number(dm[2]); const d = Number(dm[3])
  return railwayOperatingDayIsoFromLondonParts(y, mo, d, h, mi)
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
  const delayText = typeof row.delayMinutes === 'number'
    ? ` (${row.delayMinutes > 0 ? '+' : ''}${row.delayMinutes}m)`
    : ''
  const sourceText = row.liveSource ? ` · ${row.liveSource}${row.liveSourceInstance ? ` ${row.liveSourceInstance}` : ''}` : ''
  const isArrivalRow = row.movement === 'arrival'
  if (row.cancelled) {
    cls += ' dep-badge--cancelled'
    text = 'Cancelled'
  } else if (row.unknownDelay) {
    cls += ' dep-badge--late'
    text = `Delayed${sourceText}`
  } else if (historicalMode && (row.liveKind === 'scheduled' || row.liveKind === 'working')) {
    // Historical snapshots often have no meaningful live event at that minute.
    // Show a neutral marker instead of implying the service is "on time now".
    text = 'Snapshot'
  } else if (row.liveKind === 'actual') {
    cls += ' dep-badge--actual'
    text = `${row.isPassing ? 'Passed' : isArrivalRow ? 'Arrived' : 'Departed'} ${row.liveTime}${delayText}${sourceText}`
  } else if (row.liveKind === 'actual-arr') {
    cls += ' dep-badge--actual'
    text = `Arrived ${row.liveTime}${delayText}${sourceText}`
  } else if (row.liveKind === 'est' && row.liveTime !== row.scheduledTime) {
    cls += ' dep-badge--late'
    text = `${row.isPassing ? 'Exp pass' : isArrivalRow ? 'Exp arr' : 'Exp'} ${row.liveTime}${delayText}${sourceText}`
  } else if (row.liveKind === 'est-arr') {
    text = `Exp arr ${row.liveTime}${delayText}${sourceText}`
  } else {
    cls += ' dep-badge--ontime'
  }
  return <span className={cls}>{text}</span>
}

/** Build the description string for a TextCard from a departure row. */
function buildDescription(row: DepartureRow): string {
  const platform = row.livePlatform || row.platform
  const source = platformSourceLabel(row.platformSource)
  const confirmed = row.platformConfirmed ? 'confirmed' : null
  const sourceBits = [source, confirmed].filter(Boolean).join(', ')
  const platLabel = row.platformSuppressed
    ? 'Platform suppressed'
    : platform
      ? `Plat ${platform}${sourceBits ? ` (${sourceBits})` : ''}`
      : 'No platform'
  const toc = row.tocName || row.toc
  const headcode = row.trainId
  const terminatesHere = row.movement === 'arrival' && row.callingAfter.length === 0
  const passLabel = row.movement === 'arrival'
    ? (terminatesHere ? 'Terminates here' : 'Calling')
    : (row.isPassing ? 'Passing through' : 'Stopping')
  const routeHint = row.movement === 'arrival'
    ? (terminatesHere ? null : (`to ${row.destinationName || row.destination}`))
    : (row.originName ? `from ${row.originName}` : null)
  const trainLength = row.trainLength && row.trainLength > 0 ? `${row.trainLength} coaches` : null

  if (row.cancelled && row.cancellation) {
    // Some feeds report generic "schedule deactivated", which is confusing
    // to passengers; show a clean cancellation label instead.
    if (isScheduleDeactivatedReason(row.cancellation.reason)) return 'Cancelled'
    return `Cancelled — ${row.cancellation.reason}`
  }
  if (!row.cancelled && row.delayReason) {
    return `Delay reason: ${row.delayReason.reason}`
  }
  return [passLabel, platLabel, trainLength, toc, headcode, routeHint].filter(Boolean).join(' · ')
}

/** Build the title string. */
function buildTitle(row: DepartureRow): string {
  const time = formatTime(row.scheduledAt)
  if (row.movement === 'arrival') {
    const origin = row.originName || row.origin
    return `${time} · from ${origin}`
  }
  const dest = row.destinationName || row.destination
  return `${time} · ${dest}${row.isPassing ? ' (pass)' : ''}`
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
const STOP_MODE_OPTIONS: StopModeFilter[] = ['calling', 'passing']
const STOP_MODE_LABELS: Record<StopModeFilter, string> = {
  calling: 'Stopping',
  passing: 'Passing',
}
const BOARD_MODE_OPTIONS: BoardModeFilter[] = ['departures', 'arrivals']
const BOARD_MODE_LABELS: Record<BoardModeFilter, string> = {
  departures: 'Departures',
  arrivals: 'Arrivals',
}
const UNKNOWN_TOC_LABEL = 'Unknown'

function tocFilterLabel(row: DepartureRow): string {
  const label = row.tocName || row.toc
  return label && label.trim() ? label : UNKNOWN_TOC_LABEL
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

function normalizeSearchInputForMode(raw: string, mode: SearchMode): string {
  if (mode === 'station-name') return raw
  if (mode === 'crs') return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
}

function titleCaseWord(word: string): string {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function stationLikeNameFromTiploc(tpl: string): string | null {
  const raw = (tpl || '').trim().toUpperCase()
  if (!raw) return null
  if (/^[A-Z0-9]{4,}$/.test(raw)) {
    const expanded = raw
      .replace(/JNCT$/g, ' JNCT')
      .replace(/JCN$/g, ' JCN')
      .replace(/JN$/g, ' JN')
      .replace(/J$/g, ' JN')
      .replace(/PASS$/g, ' PASS')
      .replace(/PSS$/g, ' PSS')
      .replace(/HALT$/g, ' HALT')
      .replace(/(?:\d)(?=[A-Z])/g, '$& ')
      .replace(/([A-Z])([0-9])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
    const words = expanded.split(' ')
    return words.map((w) => {
      if (w === 'JN') return 'Jn'
      if (w === 'JCN') return 'Jcn'
      if (w === 'JNCT') return 'Jnct'
      if (w === 'PSS') return 'Pss'
      return titleCaseWord(w)
    }).join(' ')
  }
  return null
}

function isRawTiplocLikeName(name: string | null | undefined, fallbackCode: string): boolean {
  if (!name) return true
  const n = name.trim().toUpperCase()
  const c = (fallbackCode || '').trim().toUpperCase()
  if (!n) return true
  if (n === c) return true
  // Treat all-uppercase compact tokens as likely TIPLOC-style labels.
  return /^[A-Z0-9]{4,}$/.test(n)
}

const DarwinDeparturesPage: React.FC = () => {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const code = params.code?.toUpperCase() || ''
  const hasStationSelected = code.length > 0
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchMode, setSearchMode] = useState<SearchMode>('station-name')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [historyDateError, setHistoryDateError] = useState<string | null>(null)
  const [selectedTocs, setSelectedTocs] = useState<string[]>([])
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<DepartureServiceType[]>([])
  const [selectedStopModes, setSelectedStopModes] = useState<StopModeFilter[]>(STOP_MODE_OPTIONS)
  const [boardMode, setBoardMode] = useState<BoardModeFilter>('departures')
  const [historyDates, setHistoryDates] = useState<string[]>([])
  const { stations } = useStations()
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const from = query.get('from') || ''
  const clickedLabel = query.get('label') || ''
  const historyDate = query.get('date') || ''
  const historyTime = query.get('at') || ''
  const initialLiveWall = useMemo(() => getLiveNowPartsUk(), [])
  const [historyDateDraft, setHistoryDateDraft] = useState<string>(historyDate || initialLiveWall.date)
  const [historyTimeDraft, setHistoryTimeDraft] = useState<string>(historyTime || initialLiveWall.time)
  const todayIsoDate = getCurrentRailwayDayIsoUk()
  const maxFutureDateIso = addDaysIsoDate(getCurrentRailwayDayIsoUk(), 2)
  const operatingDayForMode = useMemo(() => {
    if (!historyDate) return todayIsoDate
    if (historyTime && /^\d{1,2}:\d{2}$/.test(historyTime.trim())) {
      return railwayOperatingDayIsoUk(historyDate, historyTime.trim())
    }
    return historyDate
  }, [historyDate, historyTime, todayIsoDate])
  const hoursFromQuery = Number(query.get('hours') || WINDOW_OPTIONS[0].value)
  const hours = WINDOW_VALUES.has(hoursFromQuery) ? hoursFromQuery : WINDOW_OPTIONS[0].value
  const historicalMode = Boolean(historyDate && operatingDayForMode < todayIsoDate)
  const timedCurrentDayMode = Boolean(historyDate && operatingDayForMode === todayIsoDate && Boolean(historyTime))
  const futureTimetableMode = Boolean(historyDate && operatingDayForMode > todayIsoDate)

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
    setBoardMode('departures')
  }, [code])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchDarwin('/api/darwin/history/dates')
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const body: HistoryDatesResponse = await res.json()
        if (cancelled) return
        const dates = (body.dates || [])
          .filter((d) => d.hasState && d.hasTimetable)
          .map((d) => d.date)
          .sort((a, b) => b.localeCompare(a))
        setHistoryDates(dates)
      } catch {
        if (cancelled) return
        setHistoryDates([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const submitSearch = () => {
    const normalizedInput = normalizeSearchInputForMode(searchInput, searchMode).trim()
    let next: string | null = null
    if (searchMode === 'station-name') {
      next = resolveSearchInput(normalizedInput, stations)
      if (!next) {
        setSearchError('No station name match found. Try the full station name or switch mode.')
        return
      }
    } else if (searchMode === 'crs') {
      if (normalizedInput.length !== 3) {
        setSearchError('CRS must be exactly 3 uppercase letters.')
        return
      }
      const byCrs = stations.find((station) => station.crsCode?.toUpperCase() === normalizedInput)
      if (!byCrs) {
        setSearchError(`No station found for CRS "${normalizedInput}".`)
        return
      }
      next = byCrs.crsCode || byCrs.tiploc
    } else {
      if (normalizedInput.length === 0) {
        setSearchError('Enter a TIPLOC code (up to 10 uppercase characters).')
        return
      }
      const byTiploc = stations.find((station) => station.tiploc?.toUpperCase() === normalizedInput)
      if (!byTiploc) {
        setSearchError(`No station found for TIPLOC "${normalizedInput}".`)
        return
      }
      next = byTiploc.crsCode || byTiploc.tiploc
    }
    const normalizedNext = String(next).toUpperCase()
    if (normalizedNext === code) return
    setSearchError(null)
    navigate(`/departures/${normalizedNext}${location.search}`)
  }

  const focusSearchInput = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
      return
    }
    // TXTINPBUTIconWideButtonSearch renders an input with the provided id.
    const el = document.getElementById('darwin-station-search')
    if (el instanceof HTMLInputElement) {
      searchInputRef.current = el
      el.focus()
      el.select()
    }
  }

  const setSearchModeAndFocus = (nextMode: SearchMode) => {
    setSearchError(null)
    setSearchMode(nextMode)
    setSearchInput((prev) => normalizeSearchInputForMode(prev, nextMode))
    window.requestAnimationFrame(focusSearchInput)
  }

  const stationLabel = useMemo(() => {
    if (!hasStationSelected) return 'Live departures'
    if (clickedLabel.trim()) return clickedLabel.trim()
    if (data?.stationName && !isRawTiplocLikeName(data.stationName, code)) {
      return data.stationCrs ? `${data.stationName} (${data.stationCrs})` : data.stationName
    }
    if (data?.stationName) {
      const humanized = stationLikeNameFromTiploc(data.stationName)
      if (humanized) return data.stationCrs ? `${humanized} (${data.stationCrs})` : humanized
    }
    const normalizedCode = code.toUpperCase()
    const stationByCrs = stations.find((station) => station.crsCode?.toUpperCase() === normalizedCode)
    if (stationByCrs?.stationName) {
      return stationByCrs.crsCode
        ? `${stationByCrs.stationName} (${stationByCrs.crsCode.toUpperCase()})`
        : stationByCrs.stationName
    }
    const stationByTiploc = stations.find((station) => station.tiploc?.toUpperCase() === normalizedCode)
    if (stationByTiploc?.stationName) {
      return stationByTiploc.crsCode
        ? `${stationByTiploc.stationName} (${stationByTiploc.crsCode.toUpperCase()})`
        : stationByTiploc.stationName
    }
    const stationLikeFallback = stationLikeNameFromTiploc(normalizedCode)
    if (stationLikeFallback) return stationLikeFallback
    return code
  }, [code, data, hasStationSelected, clickedLabel, stations])

  const windowSelectedIndex = useMemo(() => {
    const idx = WINDOW_OPTIONS.findIndex((opt) => opt.value === hours)
    return idx >= 0 ? idx : 0
  }, [hours])

  const snapshotMovementRows = useMemo(() => {
    if (!data) return []
    return [...data.departures, ...(data.arrivals ?? [])]
  }, [data])

  const tocOptions = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(snapshotMovementRows.map((row) => tocFilterLabel(row))))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [data, snapshotMovementRows])

  const serviceTypeOptions = useMemo(() => {
    if (!data) return []
    const inFeedOrder = snapshotMovementRows
      .map((row) => row.serviceType || 'other')
      .filter((value, index, arr): value is DepartureServiceType => arr.indexOf(value) === index)
    return inFeedOrder.sort((a, b) => SERVICE_TYPE_LABELS[a].localeCompare(SERVICE_TYPE_LABELS[b]))
  }, [data, snapshotMovementRows])

  useEffect(() => {
    setSelectedTocs(tocOptions)
  }, [tocOptions])

  useEffect(() => {
    setSelectedServiceTypes(serviceTypeOptions)
  }, [serviceTypeOptions])

  useEffect(() => {
    setSelectedStopModes(STOP_MODE_OPTIONS)
  }, [code])

  const filteredDepartures = useMemo(() => {
    if (!data) return []
    return data.departures.filter((row) => {
      const tocLabel = tocFilterLabel(row)
      const tocMatch = selectedTocs.includes(tocLabel)
      const rowServiceType = row.serviceType || 'other'
      const serviceTypeMatch = selectedServiceTypes.includes(rowServiceType)
      const stopMode: StopModeFilter = row.isPassing ? 'passing' : 'calling'
      const stopModeMatch = selectedStopModes.includes(stopMode)
      return tocMatch && serviceTypeMatch && stopModeMatch
    })
  }, [data, selectedTocs, selectedServiceTypes, selectedStopModes])

  const filteredArrivals = useMemo(() => {
    if (!data) return []
    const arrivals = data.arrivals ?? []
    return arrivals.filter((row) => {
      const tocLabel = tocFilterLabel(row)
      const tocMatch = selectedTocs.includes(tocLabel)
      const rowServiceType = row.serviceType || 'other'
      const serviceTypeMatch = selectedServiceTypes.includes(rowServiceType)
      return tocMatch && serviceTypeMatch
    })
  }, [data, selectedTocs, selectedServiceTypes])

  const activeFilteredRows =
    boardMode === 'departures' ? filteredDepartures : filteredArrivals

  const filteredCounts = useMemo(() => ({
    rows: activeFilteredRows.length,
    cancelled: activeFilteredRows.filter((row) => row.cancelled).length,
    withDelay: activeFilteredRows.filter((row) => row.delayReason).length,
  }), [activeFilteredRows])

  const subtitle = useMemo<React.ReactNode>(() => {
    const movementWord = boardMode === 'departures' ? 'departures' : 'arrivals'
    const countPrefix = data
      ? `${filteredCounts.rows} ${movementWord} in the next ${data.windowHours} hour${data.windowHours === 1 ? '' : 's'}`
      : null

    if (!hasStationSelected) return 'Search by station name, CRS, or TIPLOC'
    const modeSuffix = historicalMode ? ' (historical)' : futureTimetableMode ? ' (timetable)' : ''
    const operatingDayLabel = formatHeaderDate(
      data?.historicalDate ?? (historyDate ? (historyTime ? operatingDayForMode : historyDate) : todayIsoDate),
    )
    const boardDateText = historyDate && historyTime
      ? `Wall clock: ${formatHeaderDate(historyDate)} · ${historyTime} · Operating day: ${operatingDayLabel}${modeSuffix}`
      : `Operating day: ${operatingDayLabel}${modeSuffix}`
    const liveNowText = historicalMode || futureTimetableMode ? null : `Live now: ${formatLiveNowUk()}`

    if (status === 'ok') {
      const statusText = historicalMode
        ? `Historical snapshot${historyTime ? ` at ${historyTime}` : ' (latest for selected date)'}`
        : timedCurrentDayMode
          ? `Timed board from ${historyTime}`
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
        : timedCurrentDayMode
          ? `Timed board from ${historyTime}`
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
    if (status === 'loading') {
      return (
        <span className="dep-subtitle__status">
          Loading {boardMode === 'departures' ? 'departures' : 'arrivals'} for {boardDateText.toLowerCase()}…
        </span>
      )
    }
    if (status === 'error')     return <span className="dep-subtitle__status">{error ? `Error: ${error}` : 'Board data unavailable'} · {boardDateText}</span>
    if (status === 'not-found') return <span className="dep-subtitle__status">Unknown station</span>
    return ''
  }, [status, error, ageMs, hasStationSelected, data, filteredCounts.rows, boardMode, historicalMode, timedCurrentDayMode, historyDate, historyTime, futureTimetableMode, todayIsoDate, operatingDayForMode])

  const stationNameResults = useMemo(
    () => buildStationNameSearchResults(searchInput, stations),
    [searchInput, stations]
  )

  const showStationNameResults = useMemo(() => {
    if (searchMode !== 'station-name') return false
    const trimmed = searchInput.trim()
    if (trimmed.length < 2) return false
    if (trimmed === trimmed.toUpperCase() && trimmed.length <= 7) return false
    return stationNameResults.length > 0
  }, [searchInput, searchMode, stationNameResults])

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
        actionButton={from ? {
          label: '← Back',
          onClick: () => navigate(from),
        } : undefined}
      />

      <div className="darwin-departures-page">
        <div className="dep-content">
          <aside className="dep-sidebar" aria-label="Board controls">
            <section className="dep-controls-panel dep-sidebar-section" aria-label="Filters">
              <div className="dep-date-context" role="status" aria-live="polite">
                {historyDate ? (
                  <>
                    <span>
                      <strong>Wall clock (London):</strong>{' '}
                      {formatHeaderDate(historyDate)}{historyTime ? ` · ${historyTime}` : ''}
                    </span>
                    {data?.historicalDate ? (
                      <span>
                        <strong>Darwin operating day:</strong> {formatHeaderDate(data.historicalDate)}
                        {historicalMode ? ' (historical)' : futureTimetableMode ? ' (timetable)' : ''}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span>
                    <strong>Live board · operating day:</strong> {formatHeaderDate(todayIsoDate)}
                  </span>
                )}
                <span><strong>Live now:</strong> {formatLiveNowUk()}</span>
                <p className="dep-railway-day-note">
                  UK railway operating day here runs{' '}
                  <strong>02:00</strong> one morning to <strong>01:59</strong> the next calendar morning (Europe/London).
                  Between <strong>midnight and 01:59</strong>, departures still belong to the{' '}
                  <strong>previous calendar date&apos;s</strong> timetable. Use the wall-clock date and time above for that period,
                  so you see overnight trains for that operating day — not the following morning&apos;s first services.
                </p>
              </div>
              <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">Search</h2>
              <div className="dep-control-group">
                <div className="dep-search-row">
                  <TXTINPBUTIconWideButtonSearch
                    id="darwin-station-search"
                    icon={<SearchIcon />}
                    value={searchInput}
                    onChange={(value) => {
                      setSearchInput(normalizeSearchInputForMode(value, searchMode))
                      if (searchError) setSearchError(null)
                    }}
                    onSubmit={submitSearch}
                    enterKeyHint="search"
                    placeholder={
                      searchMode === 'station-name'
                        ? 'Station name e.g. Leeds'
                        : searchMode === 'crs'
                          ? 'CRS (3 letters) e.g. LDS'
                          : 'TIPLOC (max 10) e.g. LEEDS'
                    }
                    className="dep-search-input"
                    colorVariant="primary"
                  />
                </div>
                <div className="dep-search-mode-chips" role="group" aria-label="Search mode">
                  <BUTOperatorChip
                    instantAction
                    colorVariant="primary"
                    width="hug"
                    state={searchMode === 'station-name' ? 'pressed' : 'active'}
                    onClick={() => setSearchModeAndFocus('station-name')}
                    aria-label="Search by station name"
                  >
                    Station name
                  </BUTOperatorChip>
                  <BUTOperatorChip
                    instantAction
                    colorVariant="primary"
                    width="hug"
                    state={searchMode === 'crs' ? 'pressed' : 'active'}
                    onClick={() => setSearchModeAndFocus('crs')}
                    aria-label="Search by CRS code"
                  >
                    CRS
                  </BUTOperatorChip>
                  <BUTOperatorChip
                    instantAction
                    colorVariant="primary"
                    width="hug"
                    state={searchMode === 'tiploc' ? 'pressed' : 'active'}
                    onClick={() => setSearchModeAndFocus('tiploc')}
                    aria-label="Search by TIPLOC code"
                  >
                    TIPLOC
                  </BUTOperatorChip>
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
                      placeholder={initialLiveWall.date}
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
                      placeholder={initialLiveWall.time}
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
                <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">Board</h2>
                <div className="dep-search-mode-chips" role="group" aria-label="Departures or arrivals">
                  {BOARD_MODE_OPTIONS.map((mode) => (
                    <BUTOperatorChip
                      key={mode}
                      instantAction
                      colorVariant="primary"
                      width="hug"
                      state={boardMode === mode ? 'pressed' : 'active'}
                      onClick={() => setBoardMode(mode)}
                      aria-label={`Show ${BOARD_MODE_LABELS[mode]}`}
                    >
                      {BOARD_MODE_LABELS[mode]}
                    </BUTOperatorChip>
                  ))}
                </div>
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

              {boardMode === 'departures' && (
                <div className="dep-control-group">
                  <h2 className="dep-sidebar-section-title dep-sidebar-section-title--subsection">Stop mode</h2>
                  <BUTDDMListActionDual
                    items={STOP_MODE_OPTIONS.map((mode) => STOP_MODE_LABELS[mode])}
                    filterName="Stop modes"
                    selectionMode="multi"
                    selectedPositions={selectedStopModes
                      .map((mode) => STOP_MODE_OPTIONS.indexOf(mode))
                      .filter((index) => index >= 0)}
                    onSelectionChanged={(_, selectedItems) => {
                      const selected = selectedItems
                        .map((label) => STOP_MODE_OPTIONS.find((mode) => STOP_MODE_LABELS[mode] === label))
                        .filter((value): value is StopModeFilter => Boolean(value))
                      setSelectedStopModes(selected)
                    }}
                    colorVariant="primary"
                  />
                </div>
              )}

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
                <h2>Live board unavailable</h2>
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
                        : `Loading live ${boardMode === 'departures' ? 'departures' : 'arrivals'}…`}
                  </p>
                </div>
              </section>
            )}

            {data && (
              <>
                {/* NRCC operational warnings affecting this station, severity-sorted.
                 * Renders nothing when no messages are in flight. */}
                <StationMessages messages={data.messages || []} />

                {activeFilteredRows.length === 0 ? (
                  <section className="dep-state-card">
                    <p>
                      {boardMode === 'departures'
                        ? `No departures match the selected filters in the next ${data.windowHours} hour${data.windowHours === 1 ? '' : 's'}.`
                        : `No arrivals match the selected filters in the next ${data.windowHours} hour${data.windowHours === 1 ? '' : 's'}.`}
                    </p>
                  </section>
                ) : (
                  <div className="dep-cards" role="list">
                    {activeFilteredRows.map((row) => {
                      const rowKey = `${row.rid}-${row.movement ?? 'departure'}`
                      const detailPhrase = row.movement === 'arrival'
                        ? `arrival ${formatTime(row.scheduledAt)} from ${row.originName || row.origin}`
                        : `${formatTime(row.scheduledAt)} to ${row.destinationName || row.destination}`
                      return (
                        <div role="listitem" key={rowKey}>
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
                            ariaLabel={`View details for ${detailPhrase}, ${row.cancelled ? 'cancelled' : (historicalMode ? 'historical snapshot' : 'on time')}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                <footer className="dep-footer">
                  <span>Source: Network Rail Darwin Push Port</span>
                  <span className="dep-footer-sep" aria-hidden="true">·</span>
                  <DataLicenceAttribution />
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
