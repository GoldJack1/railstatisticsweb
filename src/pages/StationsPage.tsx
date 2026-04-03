import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStations } from '../hooks/useStations'
import { useDebounce } from '../hooks/useDebounce'
import ButtonBar from '../components/ButtonBar'
import Button from '../components/Button'
import type { Station, SandboxStationDoc } from '../types'
import { formatFareZoneDisplay } from '../utils/formatFareZone'
import { formatStationLocationDisplay, isGreaterLondonCounty } from '../utils/formatStationLocation'
import { buildStationPath } from '../utils/stationAreaSlug'
import { formatYearlyPassengersForReview } from '../utils/formatYearlyPassengersReview'
import { useStationCollection } from '../contexts/StationCollectionContext'
import type { StationCollectionId } from '../services/firebase'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import {
  updateStationInFirebase,
  createStationInFirebase,
  mergeStationAdditionalDetailsInFirebase,
  createScheduledStationPublishJob,
  deleteScheduledStationPublishJobDocument
} from '../services/firebase'
import { writeScheduledPublishAtMs, writeScheduleSavedFingerprint } from '../utils/scheduledPublishStorage'
import { computePendingChangesFingerprint } from '../utils/pendingChangesFingerprint'
import { toDatetimeLocalValue } from '../utils/datetimeLocal'
import { useAuth } from '../contexts/AuthContext'
import { isMasterPublishUser, MASTER_PUBLISH_DENIED_MESSAGE } from '../utils/masterPublishPolicy'
import PasswordReauthModal from '../components/PasswordReauthModal'
import '../components/Stations.css'

type SortOption = 'name-asc' | 'name-desc' | 'passengers-asc' | 'passengers-desc' | 'toc-asc' | 'toc-desc'

/** When the schedule picker is empty, save uses now + this offset (1 hour). */
const SCHEDULE_DEFAULT_OFFSET_MS = 60 * 60 * 1000

interface StationsProps {
  initialMode?: 'view' | 'edit'
}

const StationsPage: React.FC<StationsProps> = ({ initialMode = 'view' }) => {
  const { stations, loading, error, refetch } = useStations()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTOC, setSelectedTOC] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCounty, setSelectedCounty] = useState<string>('')
  const [selectedLondonBorough, setSelectedLondonBorough] = useState<string>('')
  const [selectedFareZone, setSelectedFareZone] = useState<string>('')
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [isEditMode, setIsEditMode] = useState<boolean>(initialMode === 'edit')
  const resultsSectionRef = useRef<HTMLDivElement>(null)
  const passwordReauthActionRef = useRef<'publish' | 'schedule' | 'cancelSchedule' | null>(null)
  const pendingScheduleMsRef = useRef<number | null>(null)
  const [passwordReauthOpen, setPasswordReauthOpen] = useState(false)
  const { collectionId, setCollectionId } = useStationCollection()
  const {
    pendingChanges,
    clearAllPendingChanges,
    trackedScheduledJobId,
    registerScheduledServerJob,
    clearTrackedScheduledServerJob,
    serverScheduledJobDetail
  } = usePendingStationChanges()
  const [isPublishingAll, setIsPublishingAll] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [showPendingReview, setShowPendingReview] = useState(false)
  /** Publish review panel: immediate vs server schedule (like View / Edit). */
  const [pendingPublishMode, setPendingPublishMode] = useState<'now' | 'schedule'>('now')
  const [scheduleDatetimeLocal, setScheduleDatetimeLocal] = useState('')
  /** True after the user changes the datetime-local control (required before Save changes). */
  const [scheduleDatetimeUserEdited, setScheduleDatetimeUserEdited] = useState(false)

  useEffect(() => {
    if (showPendingReview && trackedScheduledJobId) {
      setPendingPublishMode('schedule')
    }
  }, [showPendingReview, trackedScheduledJobId])

  useEffect(() => {
    if (!showPendingReview) setScheduleDatetimeUserEdited(false)
  }, [showPendingReview])

  useEffect(() => {
    if (pendingPublishMode === 'now') setScheduleDatetimeUserEdited(false)
  }, [pendingPublishMode])

  /** Live clock while schedule options are visible (local time reference). */
  const [scheduleLocalNowMs, setScheduleLocalNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!showPendingReview || pendingPublishMode !== 'schedule') return
    const id = window.setInterval(() => setScheduleLocalNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [showPendingReview, pendingPublishMode])

  const scheduleRunAtPreviewMs = useMemo(() => {
    const raw = scheduleDatetimeLocal.trim()
    if (!raw) return scheduleLocalNowMs + SCHEDULE_DEFAULT_OFFSET_MS
    const t = new Date(raw).getTime()
    return Number.isFinite(t) ? t : NaN
  }, [scheduleDatetimeLocal, scheduleLocalNowMs])

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
    navigate(isEditMode ? `/stations/${buildStationPath(station)}/edit` : `/stations/${buildStationPath(station)}`)
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
  const canMasterPublish = isMasterPublishUser(user)

  const clearScheduledPublish = useCallback(async () => {
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      return
    }
    const id = trackedScheduledJobId
    if (id) {
      try {
        await deleteScheduledStationPublishJobDocument(id)
      } catch (e) {
        console.warn('Could not delete scheduled job document:', e)
      }
    }
    clearTrackedScheduledServerJob()
    writeScheduledPublishAtMs(null)
    setScheduleDatetimeLocal('')
    setScheduleDatetimeUserEdited(false)
  }, [trackedScheduledJobId, clearTrackedScheduledServerJob, user])

  const runPublishAllImmediate = useCallback(async () => {
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      return
    }
    if (pendingCount === 0) return
    setIsPublishingAll(true)
    try {
      for (const [stationId, entry] of Object.entries(pendingChanges)) {
        if (entry.isNew) {
          await createStationInFirebase(stationId, entry.updated)
          if (entry.sandboxUpdated && Object.keys(entry.sandboxUpdated).length > 0) {
            await mergeStationAdditionalDetailsInFirebase(stationId, entry.sandboxUpdated)
          }
        } else {
          await updateStationInFirebase(stationId, entry.updated)
          if (entry.sandboxUpdated && Object.keys(entry.sandboxUpdated).length > 0) {
            await mergeStationAdditionalDetailsInFirebase(stationId, entry.sandboxUpdated)
          }
        }
      }
      const serverJobId = trackedScheduledJobId
      clearAllPendingChanges()
      if (serverJobId) {
        try {
          await deleteScheduledStationPublishJobDocument(serverJobId)
        } catch (e) {
          console.warn('Could not delete scheduled job after manual publish:', e)
        }
      }
      clearTrackedScheduledServerJob()
      writeScheduledPublishAtMs(null)
      setScheduleDatetimeLocal('')
      setScheduleDatetimeUserEdited(false)
      await refetch()
      setShowPendingReview(false)
    } finally {
      setIsPublishingAll(false)
    }
  }, [
    pendingCount,
    pendingChanges,
    clearAllPendingChanges,
    trackedScheduledJobId,
    clearTrackedScheduledServerJob,
    refetch,
    user
  ])

  const handlePublishAllClick = useCallback(() => {
    if (pendingCount === 0) return
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      return
    }
    if (
      !window.confirm(
        `Are you sure you want to publish ${pendingCount} pending change${pendingCount > 1 ? 's' : ''} to the database?`
      )
    ) {
      return
    }
    passwordReauthActionRef.current = 'publish'
    setPasswordReauthOpen(true)
  }, [pendingCount, user])

  useEffect(() => {
    if (!trackedScheduledJobId || !serverScheduledJobDetail?.runAtMs) return
    setScheduleDatetimeLocal(toDatetimeLocalValue(new Date(serverScheduledJobDetail.runAtMs)))
    setScheduleDatetimeUserEdited(false)
  }, [trackedScheduledJobId, serverScheduledJobDetail?.runAtMs])

  const executeSaveSchedule = useCallback(
    async (ms: number) => {
      if (!isMasterPublishUser(user)) {
        window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
        return
      }
      setIsSavingSchedule(true)
      try {
        const previousId = trackedScheduledJobId
        if (previousId) {
          try {
            await deleteScheduledStationPublishJobDocument(previousId)
          } catch {
            /* previous job may already be processed or missing */
          }
          clearTrackedScheduledServerJob()
        }

        const changesPayload: Record<
          string,
          { isNew?: boolean; updated: Partial<Station>; sandboxUpdated?: Partial<SandboxStationDoc> | null }
        > = {}
        for (const [stationId, entry] of Object.entries(pendingChanges)) {
          changesPayload[stationId] = {
            isNew: entry.isNew,
            updated: entry.updated,
            sandboxUpdated: entry.sandboxUpdated ?? null
          }
        }

        const jobId = await createScheduledStationPublishJob({
          runAtMs: ms,
          collectionId,
          changes: changesPayload
        })
        registerScheduledServerJob(jobId)
        writeScheduleSavedFingerprint(computePendingChangesFingerprint(pendingChanges))
        writeScheduledPublishAtMs(null)
        setScheduleDatetimeUserEdited(false)
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Failed to save schedule to the server.')
      } finally {
        setIsSavingSchedule(false)
      }
    },
    [
      trackedScheduledJobId,
      clearTrackedScheduledServerJob,
      pendingChanges,
      collectionId,
      registerScheduledServerJob,
      user
    ]
  )

  const handlePasswordReauthVerified = useCallback(() => {
    setPasswordReauthOpen(false)
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      passwordReauthActionRef.current = null
      pendingScheduleMsRef.current = null
      return
    }
    const action = passwordReauthActionRef.current
    passwordReauthActionRef.current = null
    if (action === 'publish') {
      void runPublishAllImmediate()
      return
    }
    if (action === 'schedule') {
      const ms = pendingScheduleMsRef.current
      pendingScheduleMsRef.current = null
      if (ms != null) void executeSaveSchedule(ms)
      return
    }
    if (action === 'cancelSchedule') {
      void clearScheduledPublish()
    }
  }, [runPublishAllImmediate, executeSaveSchedule, clearScheduledPublish, user])

  const handleCancelScheduleClick = useCallback(() => {
    if (!trackedScheduledJobId) return
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      return
    }
    if (!window.confirm('Cancel the server-side scheduled publish? Pending edits stay local until you publish or schedule again.')) {
      return
    }
    passwordReauthActionRef.current = 'cancelSchedule'
    setPasswordReauthOpen(true)
  }, [trackedScheduledJobId, user])

  const handleSaveSchedule = async () => {
    if (!scheduleDatetimeUserEdited) return

    const raw = scheduleDatetimeLocal.trim()
    const ms = raw
      ? new Date(raw).getTime()
      : Date.now() + SCHEDULE_DEFAULT_OFFSET_MS
    if (raw && !Number.isFinite(ms)) {
      window.alert('That date and time is not valid.')
      return
    }
    if (ms <= Date.now()) {
      window.alert('Pick a time in the future.')
      return
    }

    if (!canMasterPublish) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      return
    }

    pendingScheduleMsRef.current = ms
    passwordReauthActionRef.current = 'schedule'
    setPasswordReauthOpen(true)
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
    <div className="container container--stations">
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
                  <div className="mode-toggle" role="group" aria-label="Mode">
                    <ButtonBar
                      buttons={[
                        { label: 'View only', value: 'view' },
                        { label: 'Edit', value: 'edit' }
                      ]}
                      selectedIndex={isEditMode ? 1 : 0}
                      onChange={(_, value) => {
                        if (value === 'edit') {
                          setIsEditMode(true)
                        } else {
                          setIsEditMode(false)
                        }
                      }}
                    />
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
                {isEditMode && (
                  <div className="station-add-wrapper">
                    <Button
                      variant="wide"
                      width="fill"
                      className="station-add-button"
                      onClick={() => navigate('/stations/new')}
                    >
                      + Add new station
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {pendingCount > 0 && (
              <div className="sidebar-pending-summary">
                <Button
                  type="button"
                  variant="chip"
                  width="hug"
                  className="pending-changes-button"
                  onClick={() => setShowPendingReview(prev => !prev)}
                >
                  {pendingCount} pending change{pendingCount > 1 ? 's' : ''} ·{' '}
                  {showPendingReview ? 'Hide review' : 'Review changes'}
                </Button>
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
                  const { original, updated, isNew } = entry

                  const formatValue = (value: unknown): string => {
                    if (value === null || value === undefined || value === '') return '—'
                    return String(value)
                  }

                  const changes: Array<{ label: string; from: string; to: string }> = []
                  const addChange = (label: string, fromValue: unknown, toValue: unknown) => {
                    const fromStr = isNew ? '—' : formatValue(fromValue)
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

                  const origYearly =
                    !isNew && original.yearlyPassengers && typeof original.yearlyPassengers === 'object' && !Array.isArray(original.yearlyPassengers)
                      ? original.yearlyPassengers
                      : null
                  const updYearly =
                    updated.yearlyPassengers !== undefined && updated.yearlyPassengers !== null && typeof updated.yearlyPassengers === 'object' && !Array.isArray(updated.yearlyPassengers)
                      ? updated.yearlyPassengers
                      : origYearly

                  const originalPassengersJson =
                    origYearly !== null ? JSON.stringify(origYearly) : ''
                  const updatedPassengersJson = updYearly !== null ? JSON.stringify(updYearly) : originalPassengersJson

                  if (originalPassengersJson !== updatedPassengersJson) {
                    changes.push({
                      label: 'Yearly passengers',
                      from: formatYearlyPassengersForReview(origYearly),
                      to: formatYearlyPassengersForReview(updYearly)
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

              <div className="pending-review-publish-panel" aria-label="Publish pending changes">
                <h3 className="pending-review-schedule-title">Publish pending changes</h3>
                {!canMasterPublish && (
                  <p className="pending-review-master-notice" role="status">
                    Only the site owner can publish or schedule live database changes. You can still edit pending
                    changes locally.
                  </p>
                )}
                <div className="mode-toggle pending-review-mode-toggle" role="group" aria-label="Publish timing">
                  <ButtonBar
                    buttons={[
                      { label: 'Publish now', value: 'now' },
                      { label: 'Schedule', value: 'schedule' }
                    ]}
                    selectedIndex={pendingPublishMode === 'schedule' ? 1 : 0}
                    onChange={(_, value) => {
                      if (value === 'schedule') {
                        setPendingPublishMode('schedule')
                        setScheduleDatetimeUserEdited(false)
                        setScheduleDatetimeLocal((prev) => {
                          if (trackedScheduledJobId) return prev
                          if (prev.trim() !== '') return prev
                          return toDatetimeLocalValue(new Date(Date.now() + SCHEDULE_DEFAULT_OFFSET_MS))
                        })
                      }
                      if (value === 'now') setPendingPublishMode('now')
                    }}
                  />
                </div>
                {pendingPublishMode === 'now' ? (
                  <p className="pending-review-schedule-intro">
                    Write all pending edits to the selected data source <strong>immediately</strong> from this browser.
                  </p>
                ) : (
                  <>
                    <p className="pending-review-schedule-policy">
                      Nothing is scheduled on the server until you click <strong>Save changes</strong> below. If you edit
                      pending stations after saving, that schedule is cancelled until you save again.
                    </p>
                    <p className="pending-review-schedule-now">
                      Your time now:{' '}
                      <strong>{new Date(scheduleLocalNowMs).toLocaleString()}</strong>
                    </p>
                    <p className="pending-review-schedule-preview">
                      {Number.isFinite(scheduleRunAtPreviewMs) ? (
                        <>
                          Will publish at:{' '}
                          <strong>{new Date(scheduleRunAtPreviewMs).toLocaleString()}</strong>
                          {!scheduleDatetimeLocal.trim() ? (
                            <span className="pending-review-schedule-preview-note">
                              {' '}
                              (default — adjust in the picker to enable Save changes)
                            </span>
                          ) : !scheduleDatetimeUserEdited ? (
                            <span className="pending-review-schedule-preview-note">
                              {' '}
                              (change the date or time to enable Save changes)
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="pending-review-schedule-error">
                          Enter a valid date and time in the picker below.
                        </span>
                      )}
                    </p>
                    <details className="pending-review-schedule-picker-details">
                      <summary className="pending-review-schedule-picker-summary">
                        Change date &amp; time…
                      </summary>
                      <div className="pending-review-schedule-row">
                        <label htmlFor="pending-schedule-datetime" className="pending-review-schedule-label">
                          Date &amp; time
                        </label>
                        <input
                          id="pending-schedule-datetime"
                          type="datetime-local"
                          className="pending-review-datetime"
                          min={toDatetimeLocalValue(new Date(scheduleLocalNowMs))}
                          value={scheduleDatetimeLocal}
                          onChange={(e) => {
                            setScheduleDatetimeLocal(e.target.value)
                            setScheduleDatetimeUserEdited(true)
                          }}
                          disabled={isPublishingAll || isSavingSchedule || !canMasterPublish}
                        />
                      </div>
                    </details>
                    <div className="pending-review-schedule-actions pending-review-schedule-actions--inline">
                      <Button
                        type="button"
                        variant="wide"
                        width="hug"
                        className="pending-review-schedule-clear"
                        onClick={() => void handleCancelScheduleClick()}
                        disabled={
                          isPublishingAll || isSavingSchedule || !trackedScheduledJobId || !canMasterPublish
                        }
                      >
                        Cancel schedule
                      </Button>
                    </div>
                    {serverScheduledJobDetail && (
                      <p className="pending-review-schedule-status">
                        Job <strong>{serverScheduledJobDetail.status}</strong>
                        {' · '}
                        run at <strong>{new Date(serverScheduledJobDetail.runAtMs).toLocaleString()}</strong>
                        {serverScheduledJobDetail.errorMessage && (
                          <>
                            <br />
                            <span className="pending-review-schedule-error">{serverScheduledJobDetail.errorMessage}</span>
                          </>
                        )}
                      </p>
                    )}
                  </>
                )}

                <div className="pending-review-actions">
                  <Button
                    type="button"
                    variant="wide"
                    width="hug"
                    className="pending-review-cancel"
                    onClick={() => setShowPendingReview(false)}
                    disabled={isPublishingAll || isSavingSchedule}
                  >
                    Back
                  </Button>
                  {pendingPublishMode === 'now' ? (
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      className="pending-review-publish"
                      onClick={() => void handlePublishAllClick()}
                      disabled={isPublishingAll || isSavingSchedule || !canMasterPublish}
                    >
                      {isPublishingAll ? 'Publishing…' : 'Publish now'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      className="pending-review-publish"
                      onClick={() => void handleSaveSchedule()}
                      disabled={
                        isPublishingAll ||
                        isSavingSchedule ||
                        !Number.isFinite(scheduleRunAtPreviewMs) ||
                        !scheduleDatetimeUserEdited ||
                        !canMasterPublish
                      }
                      title={
                        !scheduleDatetimeUserEdited && Number.isFinite(scheduleRunAtPreviewMs)
                          ? 'Change the date or time in the picker first'
                          : undefined
                      }
                    >
                      {isSavingSchedule ? 'Saving…' : 'Save changes'}
                    </Button>
                  )}
                </div>
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
                id="stations-sidebar-search"
                name="station-search"
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
                <Button
                  type="button"
                  variant="circle"
                  className="clear-search-button"
                  ariaLabel="Clear all filters"
                  onClick={() => clearFilters()}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  }
                />
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
          <Button
            type="button"
            variant="wide"
            width="hug"
            className="clear-filters-button"
            onClick={() => clearFilters()}
          >
            Clear All Filters
          </Button>
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
              <Button
                type="button"
                variant="wide"
                width="hug"
                className="pagination-button"
                disabled={currentPage === 1}
                ariaLabel="Previous page"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                }
              >
                Previous
              </Button>
              
              <div className="pagination-info">
                Page {currentPage} of {totalPages}
              </div>
              
              <Button
                type="button"
                variant="wide"
                width="hug"
                className="pagination-button"
                disabled={currentPage === totalPages}
                ariaLabel="Next page"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                }
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
        </main>
      </div>
      <PasswordReauthModal
        open={passwordReauthOpen}
        user={user}
        onClose={() => {
          setPasswordReauthOpen(false)
          passwordReauthActionRef.current = null
          pendingScheduleMsRef.current = null
        }}
        onVerified={handlePasswordReauthVerified}
        title="Confirm it’s you"
      />
    </div>
  )
}

export default StationsPage

