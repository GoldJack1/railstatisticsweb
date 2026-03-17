import React, { useEffect, useState } from 'react'
import type { SandboxStationDoc, Station, YearlyPassengers } from '../../types'
import { usePendingStationChanges } from '../../contexts/PendingStationChangesContext'
import { useStationCollection } from '../../contexts/StationCollectionContext'
import { fetchStationDocumentById } from '../../services/firebase'
import Button from '../Button'
import LocationMapPicker from './LocationMapPicker'
import type { StationDetailsTab } from './StationDetailsView'
import { createPortal } from 'react-dom'

const emptyStationForm = (): Partial<Station> => ({
  stationName: '',
  crsCode: '',
  tiploc: '',
  latitude: 0,
  longitude: 0,
  country: '',
  county: '',
  toc: '',
  stnarea: '',
  londonBorough: '',
  fareZone: '',
  yearlyPassengers: null
})

const pickAdditionalDetails = (doc: SandboxStationDoc | null): Partial<SandboxStationDoc> => {
  if (!doc) return {}
  const picked: Partial<SandboxStationDoc> = {}
  const keys: Array<keyof SandboxStationDoc> = [
    'operatorCode',
    'staffingLevel',
    'nlc',
    'min-connection-time',
    'urlSlug',
    'toilets',
    'stepFree',
    'lift',
    'connections',
    'is',
    'facilities'
  ]
  for (const k of keys) {
    const v = doc[k]
    if (v !== undefined) {
      ;(picked as Record<string, unknown>)[k] = v as unknown
    }
  }
  return picked
}

const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>()

  const sortDeep = (v: unknown): unknown => {
    if (v === null || v === undefined) return v
    if (Array.isArray(v)) return v.map(sortDeep)
    if (typeof v !== 'object') return v

    const obj = v as Record<string, unknown>
    if (seen.has(obj)) return '[Circular]'
    seen.add(obj)

    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortDeep(obj[key])
    }
    return out
  }

  return JSON.stringify(sortDeep(value), null, 2)
}

const toNumberOrString = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return raw
  if (typeof raw === 'number') return raw
  const s = String(raw).trim()
  if (s === '') return ''
  const n = Number(s.replace(/,/g, ''))
  return Number.isNaN(n) ? s : n
}

const UNSAVED_MESSAGE = 'Are you sure you want to go back? All data will not be saved.'

interface StationDetailsEditFormProps {
  station: Station
  onCancel: () => void
  onSaved: () => void
  /** When set (e.g. on details page), only this section is shown. When undefined (e.g. in modal), all sections shown. */
  activeTab?: StationDetailsTab
  /** When set, renders the action buttons into the given element id. */
  actionsPortalId?: string
  /** Called when unsaved changes state changes (for parent to show confirm on Back). */
  onUnsavedChangesChange?: (dirty: boolean) => void
}

const StationDetailsEditForm: React.FC<StationDetailsEditFormProps> = ({
  station,
  onCancel,
  onSaved,
  activeTab,
  actionsPortalId,
  onUnsavedChangesChange
}) => {
  const showAll = activeTab === undefined
  const showDetails = showAll || activeTab === 'details'
  const showLocationTab = showAll || activeTab === 'location'
  const showUsage = showAll || activeTab === 'usage'
  const showAdditional = showAll || activeTab === 'additional'
  const showStepFree = showAll || activeTab === 'stepFree'
  const showService = showAll || activeTab === 'service'
  const showFacilities = showAll || activeTab === 'facilities'
  const [form, setForm] = useState<Partial<Station>>(emptyStationForm)
  const [yearlyPassengersRows, setYearlyPassengersRows] = useState<Array<{ year: string; value: string }>>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [preparedYearlyPassengers, setPreparedYearlyPassengers] = useState<YearlyPassengers | null>(null)
  const [additionalForm, setAdditionalForm] = useState<Partial<SandboxStationDoc>>({})
  const [facilitiesRows, setFacilitiesRows] = useState<Array<{ key: string; value: string }>>([])
  const [preparedAdditionalDetails, setPreparedAdditionalDetails] = useState<Partial<SandboxStationDoc> | null>(null)
  const { upsertPendingChange } = usePendingStationChanges()
  const { collectionId } = useStationCollection()
  const [additionalDoc, setAdditionalDoc] = useState<SandboxStationDoc | null>(null)
  const [additionalLoading, setAdditionalLoading] = useState(false)

  useEffect(() => {
    setForm({
      stationName: station.stationName ?? '',
      crsCode: station.crsCode ?? '',
      tiploc: station.tiploc ?? '',
      latitude: station.latitude ?? 0,
      longitude: station.longitude ?? 0,
      country: station.country ?? '',
      county: station.county ?? '',
      toc: station.toc ?? '',
      stnarea: station.stnarea ?? '',
      londonBorough: station.londonBorough ?? '',
      fareZone: station.fareZone ?? '',
      yearlyPassengers: station.yearlyPassengers ?? null
    })
    const yp =
      station.yearlyPassengers && typeof station.yearlyPassengers === 'object' && !Array.isArray(station.yearlyPassengers)
        ? (station.yearlyPassengers as YearlyPassengers)
        : null
    const ypRows = yp
      ? Object.entries(yp)
          .filter(([k]) => /^\d{4}$/.test(k))
          .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
          .map(([year, value]) => ({ year, value: value == null ? '' : String(value) }))
      : []
    setYearlyPassengersRows(ypRows)
    setSaveError(null)
    setIsReviewing(false)
    setPreparedYearlyPassengers(
      station.yearlyPassengers && typeof station.yearlyPassengers === 'object' && !Array.isArray(station.yearlyPassengers)
        ? (station.yearlyPassengers as YearlyPassengers)
        : null
    )
    setPreparedAdditionalDetails(null)
  }, [station])

  useEffect(() => {
    let cancelled = false
    setAdditionalLoading(true)
    setAdditionalDoc(null)
    fetchStationDocumentById(station.id)
      .then((data) => {
        if (!cancelled && data) {
          const doc = data as SandboxStationDoc
          setAdditionalDoc(doc)
          const picked = pickAdditionalDetails(doc)
          setAdditionalForm(picked)
          const facilities =
            picked.facilities && typeof picked.facilities === 'object' && !Array.isArray(picked.facilities)
              ? (picked.facilities as Record<string, unknown>)
              : {}
          const rows = Object.entries(facilities).map(([k, v]) => ({ key: k, value: v == null ? '' : String(v) }))
          setFacilitiesRows(rows.length > 0 ? rows : [])
        }
      })
      .finally(() => {
        if (!cancelled) setAdditionalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [collectionId, station.id])

  const update = (updates: Partial<Station>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const validateAndPrepareYearlyPassengers = (): YearlyPassengers | null | 'error' => {
    setSaveError(null)
    if (yearlyPassengersRows.length === 0) return null

    const out: YearlyPassengers = {}
    const seen = new Set<string>()

    for (const row of yearlyPassengersRows) {
      const year = row.year.trim()
      if (!year) continue
      if (!/^\d{4}$/.test(year)) {
        setSaveError('Year must be a 4-digit year (e.g. 2021)')
        return 'error'
      }
      if (seen.has(year)) {
        setSaveError(`Duplicate year: ${year}`)
        return 'error'
      }
      seen.add(year)

      const raw = row.value.trim()
      if (raw === '') {
        out[year] = null
        continue
      }
      const num = Number(raw.replace(/,/g, ''))
      if (Number.isNaN(num)) {
        setSaveError(`Passenger value for ${year} must be a number`)
        return 'error'
      }
      out[year] = num
    }
    return Object.keys(out).length > 0 ? out : null
  }

  const validateAndPrepareAdditionalDetails = (): Partial<SandboxStationDoc> | null | 'error' => {
    setSaveError(null)
    const picked = pickAdditionalDetails(additionalForm as SandboxStationDoc)

    const facilities: Record<string, unknown> = {}
    for (const row of facilitiesRows) {
      const k = row.key.trim()
      if (!k) continue
      const raw = row.value.trim()
      if (raw === '') {
        // Preserve existing facility keys as explicit nulls so "no change" doesn't
        // look like a diff just because blank inputs were omitted.
        facilities[k] = null
        continue
      }
      if (raw === 'true') facilities[k] = true
      else if (raw === 'false') facilities[k] = false
      else if (!Number.isNaN(Number(raw)) && raw !== '') facilities[k] = Number(raw)
      else facilities[k] = raw
    }
    if (Object.keys(facilities).length > 0) {
      picked.facilities = facilities
    } else {
      delete picked.facilities
    }
    return Object.keys(picked).length > 0 ? picked : null
  }

  const updateAdditional = (updates: Partial<SandboxStationDoc>) => {
    setAdditionalForm((prev) => ({ ...prev, ...updates }))
  }

  const updateAdditionalNested = <K extends keyof SandboxStationDoc>(key: K, nested: Record<string, unknown>) => {
    setAdditionalForm((prev) => ({
      ...prev,
      [key]: { ...(typeof prev[key] === 'object' && prev[key] !== null ? (prev[key] as object) : {}), ...nested }
    }))
  }

  const hasDetectedChanges = (): boolean => {
    const normStr = (v: unknown) => String(v ?? '').trim()
    const normOpt = (v: unknown) => {
      const s = normStr(v)
      return s === '' ? null : s
    }

    const currentStation = {
      stationName: normOpt(station.stationName),
      crsCode: normOpt(station.crsCode),
      tiploc: normOpt(station.tiploc),
      toc: normOpt(station.toc),
      country: normOpt(station.country),
      county: normOpt(station.county),
      stnarea: normOpt(station.stnarea),
      londonBorough: normOpt(station.londonBorough),
      fareZone: normOpt(station.fareZone),
      latitude: Number(station.latitude ?? 0),
      longitude: Number(station.longitude ?? 0)
    }

    const draftStation = {
      stationName: normOpt(form.stationName),
      crsCode: normOpt(form.crsCode),
      tiploc: normOpt(form.tiploc),
      toc: normOpt(form.toc),
      country: normOpt(form.country),
      county: normOpt(form.county),
      stnarea: normOpt(form.stnarea),
      londonBorough: normOpt(form.londonBorough),
      fareZone: normOpt(form.fareZone),
      latitude: Number(toNumberOrString(form.latitude) || 0),
      longitude: Number(toNumberOrString(form.longitude) || 0)
    }

    if (stableStringify(currentStation) !== stableStringify(draftStation)) return true

    // Yearly passengers: compare the object as stored, not the raw rows UI.
    const currentPassengers =
      station.yearlyPassengers && typeof station.yearlyPassengers === 'object' && !Array.isArray(station.yearlyPassengers)
        ? (station.yearlyPassengers as Record<string, unknown>)
        : null
    const draftPassengers = (() => {
      if (yearlyPassengersRows.length === 0) return null
      const out: Record<string, unknown> = {}
      for (const row of yearlyPassengersRows) {
        const year = String(row.year ?? '').trim()
        if (!year) continue
        const raw = String(row.value ?? '').trim()
        if (raw === '') out[year] = null
        else out[year] = toNumberOrString(raw)
      }
      return Object.keys(out).length > 0 ? out : null
    })()
    if (stableStringify(currentPassengers) !== stableStringify(draftPassengers)) return true

    // Additional details: compare a draft built the same way review/save do.
    const draftAdditional = (() => {
      const picked = pickAdditionalDetails(additionalForm as SandboxStationDoc)
      const facilities: Record<string, unknown> = {}
      for (const row of facilitiesRows) {
        const k = row.key.trim()
        if (!k) continue
        const raw = row.value.trim()
        if (raw === '') {
          facilities[k] = null
          continue
        }
        if (raw === 'true') facilities[k] = true
        else if (raw === 'false') facilities[k] = false
        else if (!Number.isNaN(Number(raw)) && raw !== '') facilities[k] = Number(raw)
        else facilities[k] = raw
      }
      if (Object.keys(facilities).length > 0) picked.facilities = facilities
      else delete picked.facilities
      return Object.keys(picked).length > 0 ? picked : null
    })()

    const currentAdditional = pickAdditionalDetails(additionalDoc)
    if (stableStringify(currentAdditional) !== stableStringify(draftAdditional)) return true

    return false
  }

  useEffect(() => {
    onUnsavedChangesChange?.(hasDetectedChanges())
  }, [form, additionalForm, yearlyPassengersRows, facilitiesRows, station, additionalDoc, onUnsavedChangesChange])

  const handleBeginReview = () => {
    if (!hasDetectedChanges()) {
      setSaveError('No changes to save.')
      return
    }
    const result = validateAndPrepareYearlyPassengers()
    if (result === 'error') return
    setPreparedYearlyPassengers(result as YearlyPassengers | null)
    const addl = validateAndPrepareAdditionalDetails()
    if (addl === 'error') return
    setPreparedAdditionalDetails(addl as Partial<SandboxStationDoc> | null)
    setIsReviewing(true)
  }

  const handlePublish = async () => {
    const yearlyPassengers =
      preparedYearlyPassengers !== null ? preparedYearlyPassengers : validateAndPrepareYearlyPassengers()
    if (yearlyPassengers === 'error') {
      setIsReviewing(false)
      return
    }
    const additionalDetails =
      preparedAdditionalDetails !== null ? preparedAdditionalDetails : validateAndPrepareAdditionalDetails()
    if (additionalDetails === 'error') {
      setIsReviewing(false)
      return
    }

    setSaving(true)
    try {
      const requiredMissing: string[] = []
      const stationName = String(form.stationName ?? '').trim()
      const crsCode = String(form.crsCode ?? '').trim()
      const tiploc = String(form.tiploc ?? '').trim()
      const toc = String(form.toc ?? '').trim()
      const country = String(form.country ?? '').trim()
      const county = String(form.county ?? '').trim()
      const stnarea = String(form.stnarea ?? '').trim()
      const latRaw = String(form.latitude ?? '').trim()
      const lngRaw = String(form.longitude ?? '').trim()
      const urlSlug = String(additionalForm.urlSlug ?? (additionalDoc?.urlSlug ?? '')).trim()

      if (!stationName) requiredMissing.push('Station name')
      if (!crsCode) requiredMissing.push('CRS Code')
      if (!tiploc) requiredMissing.push('Tiploc')
      if (!toc) requiredMissing.push('TOC')
      if (!country) requiredMissing.push('Country')
      if (!county) requiredMissing.push('County')
      if (!stnarea) requiredMissing.push('Station area')
      if (!latRaw) requiredMissing.push('Latitude')
      if (!lngRaw) requiredMissing.push('Longitude')
      if (!urlSlug) requiredMissing.push('URL slug')

      if (requiredMissing.length > 0) {
        setSaveError(`Missing required fields: ${requiredMissing.join(', ')}.`)
        setSaving(false)
        return
      }

      const lat = typeof form.latitude === 'number' ? form.latitude : parseFloat(String(form.latitude)) || 0
      const lng = typeof form.longitude === 'number' ? form.longitude : parseFloat(String(form.longitude)) || 0

      upsertPendingChange(
        station,
        {
          stationName,
          crsCode,
          tiploc: tiploc || null,
          latitude: lat,
          longitude: lng,
          country: country || null,
          county: county || null,
          toc: toc || null,
          stnarea: stnarea || null,
          londonBorough: form.londonBorough || null,
          fareZone: form.fareZone || null,
          yearlyPassengers
        },
        { ...(additionalDetails as Partial<SandboxStationDoc> | null), urlSlug }
      )
      onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const formatDisplayValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  const changes: Array<{ label: string; from: string; to: string }> = []

  if (isReviewing) {
    const addChange = (label: string, fromValue: unknown, toValue: unknown) => {
      const fromStr = formatDisplayValue(fromValue)
      const toStr = formatDisplayValue(toValue)
      if (fromStr !== toStr) changes.push({ label, from: fromStr, to: toStr })
    }

    addChange('Station name', station.stationName ?? '', form.stationName ?? '')
    addChange('CRS code', station.crsCode ?? '', form.crsCode ?? '')
    addChange('Tiploc', station.tiploc ?? '', form.tiploc ?? '')
    addChange('TOC', station.toc ?? '', form.toc ?? '')
    addChange('Country', station.country ?? '', form.country ?? '')
    addChange('County', station.county ?? '', form.county ?? '')
    addChange('Station area', station.stnarea ?? '', form.stnarea ?? '')
    addChange('London Borough', station.londonBorough ?? '', form.londonBorough ?? '')
    addChange('Fare Zone', station.fareZone ?? '', form.fareZone ?? '')
    addChange('Latitude', station.latitude ?? '', form.latitude ?? '')
    addChange('Longitude', station.longitude ?? '', form.longitude ?? '')

    const originalPassengers =
      station.yearlyPassengers && typeof station.yearlyPassengers === 'object' && !Array.isArray(station.yearlyPassengers)
        ? JSON.stringify(station.yearlyPassengers)
        : ''
    const newPassengers =
      preparedYearlyPassengers && typeof preparedYearlyPassengers === 'object'
        ? JSON.stringify(preparedYearlyPassengers)
        : ''
    if (originalPassengers !== newPassengers) {
      changes.push({
        label: 'Yearly passengers',
        from: originalPassengers || '—',
        to: newPassengers || '—'
      })
    }

    const originalAdditional = stableStringify(pickAdditionalDetails(additionalDoc))
    const newAdditional =
      preparedAdditionalDetails && typeof preparedAdditionalDetails === 'object'
        ? stableStringify(preparedAdditionalDetails)
        : stableStringify(pickAdditionalDetails(additionalForm as SandboxStationDoc))
    if ((originalAdditional || '').trim() !== (newAdditional || '').trim()) {
      changes.push({
        label: 'Additional details',
        from: originalAdditional.trim() ? originalAdditional : '—',
        to: newAdditional.trim() ? newAdditional : '—'
      })
    }
  }

  return (
    <div className="modal-body">
      {!isReviewing ? (
        <>
          {showDetails && (
        <div className="modal-section">
          <h3 className="modal-section-title">Details</h3>
          <div className="modal-detail-item edit-readonly">
            <span className="modal-detail-label">Station ID</span>
            <span className="modal-detail-value">{station.id}</span>
          </div>

          <p className="edit-hint">Required fields are marked *</p>

          <div className="edit-form-grid">
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-stationName">
                Station name *
              </label>
              <input
                id="edit-stationName"
                type="text"
                value={form.stationName ?? ''}
                onChange={(e) => update({ stationName: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-crsCode">
                CRS Code *
              </label>
              <input
                id="edit-crsCode"
                type="text"
                value={form.crsCode ?? ''}
                onChange={(e) => update({ crsCode: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-tiploc">
                Tiploc *
              </label>
              <input
                id="edit-tiploc"
                type="text"
                value={form.tiploc ?? ''}
                onChange={(e) => update({ tiploc: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-toc">
                TOC *
              </label>
              <input
                id="edit-toc"
                type="text"
                value={form.toc ?? ''}
                onChange={(e) => update({ toc: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-country">
                Country *
              </label>
              <input
                id="edit-country"
                type="text"
                value={form.country ?? ''}
                onChange={(e) => update({ country: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-county">
                County *
              </label>
              <input
                id="edit-county"
                type="text"
                value={form.county ?? ''}
                onChange={(e) => update({ county: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-stnarea">
                Station area *
              </label>
              <input
                id="edit-stnarea"
                type="text"
                value={form.stnarea ?? ''}
                onChange={(e) => update({ stnarea: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-londonBorough">
                London Borough
              </label>
              <input
                id="edit-londonBorough"
                type="text"
                value={form.londonBorough ?? ''}
                onChange={(e) => update({ londonBorough: e.target.value })}
                className="edit-input"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-fareZone">
                Fare Zone
              </label>
              <input
                id="edit-fareZone"
                type="text"
                value={form.fareZone ?? ''}
                onChange={(e) => update({ fareZone: e.target.value })}
                className="edit-input"
              />
            </div>
          </div>
        </div>
          )}

          {showLocationTab && (
            <div className="modal-section">
              <h3 className="modal-section-title">Location</h3>
              <LocationMapPicker
                latitude={Number(form.latitude ?? 0)}
                longitude={Number(form.longitude ?? 0)}
                onLatLngChange={(lat, lng) => update({ latitude: lat, longitude: lng })}
                height={480}
              />
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-latitude">
                    Latitude *
                  </label>
                  <input
                    id="edit-latitude"
                    type="number"
                    step="any"
                    value={form.latitude ?? ''}
                    onChange={(e) => update({ latitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-longitude">
                    Longitude *
                  </label>
                  <input
                    id="edit-longitude"
                    type="number"
                    step="any"
                    value={form.longitude ?? ''}
                    onChange={(e) => update({ longitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>
          )}

          {showUsage && (
          <div className="modal-section">
            <h3 className="modal-section-title">Usage</h3>
            {yearlyPassengersRows.length === 0 && <p className="edit-hint">No yearly passenger rows set.</p>}
            {yearlyPassengersRows.map((row, idx) => (
              <div key={`${idx}-${row.year}`} className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor={`edit-year-${idx}`}>
                    Year
                  </label>
                  <input
                    id={`edit-year-${idx}`}
                    type="text"
                    value={row.year}
                    onChange={(e) => {
                      const v = e.target.value
                      setYearlyPassengersRows((prev) => prev.map((r, i) => (i === idx ? { ...r, year: v } : r)))
                    }}
                    className="edit-input"
                    placeholder="e.g. 2021"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor={`edit-passengers-${idx}`}>
                    Passengers
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      id={`edit-passengers-${idx}`}
                      type="text"
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value
                        setYearlyPassengersRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: v } : r)))
                      }}
                      className="edit-input"
                      placeholder="e.g. 123456"
                      style={{ flex: 1 }}
                    />
                    <Button
                      type="button"
                      variant="circle"
                      ariaLabel="Remove yearly passenger row"
                      onClick={() => setYearlyPassengersRows((prev) => prev.filter((_, i) => i !== idx))}
                      icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="wide" width="hug" onClick={() => setYearlyPassengersRows((prev) => [...prev, { year: '', value: '' }])}>
              + Add year
            </Button>
          </div>
          )}

          {showAdditional && (
          <div className="modal-section">
            <h3 className="modal-section-title">Additional details</h3>
            {additionalLoading && <p className="modal-sandbox-loading">Loading additional details…</p>}

            <div className="edit-form-grid">
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-operatorCode">
                  Operator Code
                </label>
                <input
                  id="edit-operatorCode"
                  type="text"
                  value={String(additionalForm.operatorCode ?? '')}
                  onChange={(e) => updateAdditional({ operatorCode: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-staffingLevel">
                  Staffing Level
                </label>
                <input
                  id="edit-staffingLevel"
                  type="text"
                  value={String(additionalForm.staffingLevel ?? '')}
                  onChange={(e) => updateAdditional({ staffingLevel: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-nlc">
                  NLC
                </label>
                <input
                  id="edit-nlc"
                  type="text"
                  value={String(additionalForm.nlc ?? '')}
                  onChange={(e) => updateAdditional({ nlc: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-minConnectionTime">
                  Min connection time
                </label>
                <input
                  id="edit-minConnectionTime"
                  type="text"
                  value={String((additionalForm['min-connection-time'] as unknown) ?? '')}
                  onChange={(e) => updateAdditional({ 'min-connection-time': e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field edit-field-full">
                <label className="edit-label" htmlFor="edit-urlSlug">
                  URL slug *
                </label>
                <input
                  id="edit-urlSlug"
                  type="text"
                  value={String(additionalForm.urlSlug ?? '')}
                  onChange={(e) => updateAdditional({ urlSlug: e.target.value })}
                  className="edit-input"
                />
              </div>
            </div>

          </div>
          )}

          {showFacilities && (
            <div className="modal-section">
              <h3 className="modal-section-title">Toilets</h3>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-toiletsAccessible">
                    Accessible
                  </label>
                  <input
                    id="edit-toiletsAccessible"
                    type="text"
                    value={String(additionalForm.toilets?.toiletsAccessible ?? '')}
                    onChange={(e) => updateAdditionalNested('toilets', { toiletsAccessible: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-toiletsChangingPlace">
                    Changing Place
                  </label>
                  <input
                    id="edit-toiletsChangingPlace"
                    type="text"
                    value={String(additionalForm.toilets?.toiletsChangingPlace ?? '')}
                    onChange={(e) => updateAdditionalNested('toilets', { toiletsChangingPlace: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-toiletsBabyChanging">
                    Baby changing
                  </label>
                  <input
                    id="edit-toiletsBabyChanging"
                    type="text"
                    value={String(additionalForm.toilets?.toiletsBabyChanging ?? '')}
                    onChange={(e) => updateAdditionalNested('toilets', { toiletsBabyChanging: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>
          )}

          {showStepFree && (
            <div className="modal-section">
              <h3 className="modal-section-title">Step-free & Lift access</h3>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-stepFreeCode">
                    Code
                  </label>
                  <input
                    id="edit-stepFreeCode"
                    type="text"
                    value={String(additionalForm.stepFree?.stepFreeCode ?? '')}
                    onChange={(e) => updateAdditionalNested('stepFree', { stepFreeCode: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="edit-stepFreeNote">
                    Note
                  </label>
                  <input
                    id="edit-stepFreeNote"
                    type="text"
                    value={String(additionalForm.stepFree?.stepFreeNote ?? '')}
                    onChange={(e) => updateAdditionalNested('stepFree', { stepFreeNote: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>
          )}

          {showStepFree && (
            <div className="modal-section">
              <h3 className="modal-section-title">Lift</h3>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-liftAvailable">
                    Available
                  </label>
                  <input
                    id="edit-liftAvailable"
                    type="text"
                    value={String(additionalForm.lift?.liftAvailable ?? '')}
                    onChange={(e) => updateAdditionalNested('lift', { liftAvailable: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="edit-liftNotes">
                    Notes
                  </label>
                  <input
                    id="edit-liftNotes"
                    type="text"
                    value={String(additionalForm.lift?.liftNotes ?? '')}
                    onChange={(e) => updateAdditionalNested('lift', { liftNotes: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="edit-liftDetails">
                    Details
                  </label>
                  <input
                    id="edit-liftDetails"
                    type="text"
                    value={String(additionalForm.lift?.liftDetails ?? '')}
                    onChange={(e) => updateAdditionalNested('lift', { liftDetails: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>
          )}

          {showService && (
            <div className="modal-section">
              <h3 className="modal-section-title">Service & Connections</h3>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-connectionBus">
                    Bus
                  </label>
                  <input
                    id="edit-connectionBus"
                    type="text"
                    value={String(additionalForm.connections?.connectionBus ?? '')}
                    onChange={(e) => updateAdditionalNested('connections', { connectionBus: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-connectionTaxi">
                    Taxi
                  </label>
                  <input
                    id="edit-connectionTaxi"
                    type="text"
                    value={String(additionalForm.connections?.connectionTaxi ?? '')}
                    onChange={(e) => updateAdditionalNested('connections', { connectionTaxi: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-connectionUnderground">
                    Underground
                  </label>
                  <input
                    id="edit-connectionUnderground"
                    type="text"
                    value={String(additionalForm.connections?.connectionUnderground ?? '')}
                    onChange={(e) => updateAdditionalNested('connections', { connectionUnderground: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-requestStop">
                    Request stop
                  </label>
                  <input
                    id="edit-requestStop"
                    type="text"
                    value={String(additionalForm.is?.isrequeststop ?? '')}
                    onChange={(e) => updateAdditionalNested('is', { isrequeststop: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-limitedService">
                    Limited service
                  </label>
                  <input
                    id="edit-limitedService"
                    type="text"
                    value={String(additionalForm.is?.Islimitedservice ?? '')}
                    onChange={(e) => updateAdditionalNested('is', { Islimitedservice: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>
          )}

          {showFacilities && (
            <div className="modal-section">
              <h3 className="modal-section-title">Facilities</h3>
              {facilitiesRows.length === 0 && <p className="edit-hint">No facilities set for this station.</p>}
              {facilitiesRows.length > 0 && (
                <div className="edit-form-grid">
                  {facilitiesRows.map((row, idx) => {
                    const label = row.key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/[_-]+/g, ' ')
                      .replace(/^./, (s) => s.toUpperCase())
                    return (
                      <div key={`${idx}-${row.key}`} className="edit-field">
                        <label className="edit-label" htmlFor={`edit-facility-${idx}`}>
                          {label}
                        </label>
                        <input
                          id={`edit-facility-${idx}`}
                          type="text"
                          value={row.value}
                          onChange={(e) => {
                            const v = e.target.value
                            setFacilitiesRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: v } : r)))
                          }}
                          className="edit-input"
                          placeholder="—"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="modal-section edit-review-section">
          <div className="edit-review-header">
            <h3 className="edit-review-title">Review changes before publishing</h3>
            <p className="edit-review-subtitle">These changes will be published to the currently selected data source.</p>
          </div>
          {changes.length === 0 ? (
            <p className="edit-review-empty">No changes detected compared to the current database values.</p>
          ) : (
            <ul className="edit-review-list">
              {changes.map((change) => (
                <li key={change.label} className="edit-review-item">
                  <div className="edit-review-label">{change.label}</div>
                  <div className="edit-review-values">
                    <span className="edit-review-from">{change.from}</span>
                    <span className="edit-review-arrow">→</span>
                    <span className="edit-review-to">{change.to}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {saveError && (
        <div className="edit-error" role="alert">
          {saveError}
        </div>
      )}

      {(() => {
        const actions = (
          <div className="modal-edit-actions modal-edit-actions--inline">
            <Button
              type="button"
              variant="wide"
              width="hug"
              className="edit-cancel-button"
              onClick={() => {
                if (isReviewing) {
                  setIsReviewing(false)
                  return
                }
                if (hasDetectedChanges() && !window.confirm(UNSAVED_MESSAGE)) return
                onCancel()
              }}
            >
              {isReviewing ? 'Back to editing' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="wide"
              width="hug"
              className="edit-save-button"
              onClick={() => (isReviewing ? handlePublish() : handleBeginReview())}
              disabled={saving || (!isReviewing && !hasDetectedChanges())}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )

        const portalEl =
          actionsPortalId && typeof document !== 'undefined' ? document.getElementById(actionsPortalId) : null
        return portalEl ? createPortal(actions, portalEl) : actions
      })()}
    </div>
  )
}

export default StationDetailsEditForm

