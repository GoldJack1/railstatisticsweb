import React, { useEffect, useState } from 'react'
import type { SandboxStationDoc, Station, YearlyPassengers } from '../types'
import './StationModal.css'
import './StationEditModal.css'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import Button from './Button'

interface NewStationModalProps {
  isOpen: boolean
  onClose: () => void
  nextStationId: string
}

type NewStationForm = Partial<Station>

type YearlyPassengerRow = { year: string; value: string }

const DEFAULT_FACILITY_KEYS: string[] = [
  'facilitiesDropOffNotes',
  'facilitiesCarParksSpaces',
  'facilitiesTicketMachinesAvailable',
  'facilitiesCarParksAvailable',
  'facilitiesInductionLoopProvision',
  'facilitiesHelpPointsAvailable',
  'facilitiesPlatformWaitingTypes',
  'facilitiesTicketOfficeAvailable',
  'facilitiesWheelchairsAvailable',
  'facilitiesShopsAvailable',
  'facilitiesShelteredWaiting',
  'facilitiesTicketBuyingNotes',
  'facilitiesAccessibleParkingAvailable',
  'facilitiesAnnouncementsNotes',
  'facilitiesEscalatorInfo',
  'facilitiesPayPhonesAvailable',
  'facilitiesWaitingRoomsAvailable',
  'facilitiesNearestAccessibleStations',
  'facilitiesCyclingNotes',
  'facilitiesPlatformFacilitiesNotes',
  'facilitiesWifiAvailable',
  'facilitiesTicketBarriersNotes',
  'facilitiesWaitingRoomsNotes',
  'facilitiesCyclingStorageTypes',
  'facilitiesDropOffPickUpAvailable',
  'facilitiesCyclingAvailable',
  'facilitiesPassengerAssistanceNotes',
  'facilitiesInductionLoopsNotes',
  'facilitiesRampNotes',
  'facilitiesRefreshmentsAvailable',
  'facilitiesTactilePaving',
  'facilitiesCctvAvailable'
]

const buildDefaultYearlyPassengerRows = (): YearlyPassengerRow[] => {
  const currentYear = new Date().getFullYear()
  const rows: YearlyPassengerRow[] = []
  for (let year = 1998; year <= currentYear; year += 1) {
    rows.push({ year: String(year), value: '' })
  }
  return rows
}

const buildDefaultFacilitiesRows = (): Array<{ key: string; value: string }> =>
  DEFAULT_FACILITY_KEYS.map((key) => ({ key, value: '' }))

const emptyForm = (): NewStationForm => ({
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
  fareZone: ''
})

const NewStationModal: React.FC<NewStationModalProps> = ({ isOpen, onClose, nextStationId }) => {
  const [form, setForm] = useState<NewStationForm>(emptyForm)
  const [yearlyPassengersRows, setYearlyPassengersRows] = useState<YearlyPassengerRow[]>(buildDefaultYearlyPassengerRows)
  const [additionalForm, setAdditionalForm] = useState<Partial<SandboxStationDoc>>({})
  const [facilitiesRows, setFacilitiesRows] = useState<Array<{ key: string; value: string }>>(buildDefaultFacilitiesRows)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { addNewPendingStation } = usePendingStationChanges()

  useEffect(() => {
    if (!isOpen) return
    // Ensure newly opened modal always starts with full 1998→present rows.
    setYearlyPassengersRows(buildDefaultYearlyPassengerRows())
    setFacilitiesRows(buildDefaultFacilitiesRows())
  }, [isOpen])

  if (!isOpen) return null

  const update = (updates: Partial<NewStationForm>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const handleClose = () => {
    if (saving) return
    setForm(emptyForm())
    setYearlyPassengersRows(buildDefaultYearlyPassengerRows())
    setAdditionalForm({})
    setFacilitiesRows(buildDefaultFacilitiesRows())
    setSaveError(null)
    onClose()
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

  const validateAndPrepareAdditionalDetails = (): Partial<SandboxStationDoc> | null => {
    const payload: Partial<SandboxStationDoc> = { ...additionalForm }
    const facilities: Record<string, unknown> = {}
    for (const row of facilitiesRows) {
      const k = row.key.trim()
      if (!k) continue
      const raw = row.value.trim()
      if (raw === '') {
        facilities[k] = null
      } else if (raw === 'true') facilities[k] = true
      else if (raw === 'false') facilities[k] = false
      else if (!Number.isNaN(Number(raw)) && raw !== '') facilities[k] = Number(raw)
      else facilities[k] = raw
    }
    payload.facilities = facilities
    const cleaned = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ) as Partial<SandboxStationDoc>
    return Object.keys(cleaned).length > 0 ? cleaned : null
  }

  const updateAdditional = (updates: Partial<SandboxStationDoc>) => {
    setAdditionalForm(prev => ({ ...prev, ...updates }))
  }

  const updateAdditionalNested = <K extends keyof SandboxStationDoc>(
    key: K,
    nested: Record<string, unknown>
  ) => {
    setAdditionalForm(prev => ({
      ...prev,
      [key]: { ...(typeof prev[key] === 'object' && prev[key] !== null ? (prev[key] as object) : {}), ...nested }
    }))
  }

  const handleSave = async () => {
    setSaveError(null)

    const name = (form.stationName ?? '').trim()
    const crs = (form.crsCode ?? '').trim()
    const tiploc = (form.tiploc ?? '').trim()
    const toc = (form.toc ?? '').trim()
    const country = (form.country ?? '').trim()
    const county = (form.county ?? '').trim()
    const stnarea = (form.stnarea ?? '').trim()
    const urlSlug = String(additionalForm.urlSlug ?? '').trim()

    if (!name || !crs || !tiploc || !toc || !country || !county || !stnarea || !urlSlug) {
      setSaveError(
        'Missing required fields: Station name, CRS Code, Tiploc, TOC, Country, County, Station area, URL slug.'
      )
      return
    }

    const lat =
      typeof form.latitude === 'number'
        ? form.latitude
        : parseFloat(String(form.latitude ?? '')) || 0
    const lng =
      typeof form.longitude === 'number'
        ? form.longitude
        : parseFloat(String(form.longitude ?? '')) || 0

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (String(form.latitude ?? '').trim() === '') || (String(form.longitude ?? '').trim() === '')) {
      setSaveError('Missing required fields: Latitude, Longitude.')
      return
    }

    const yearlyPassengers = validateAndPrepareYearlyPassengers()
    if (yearlyPassengers === 'error') return

    const payload: Partial<Station> = {
      stationName: name,
      crsCode: crs,
      tiploc: tiploc || null,
      latitude: lat,
      longitude: lng,
      country: country || null,
      county: county || null,
      toc: toc || null,
      stnarea: stnarea || null,
      londonBorough: (form.londonBorough ?? '').trim() || null,
      fareZone: (form.fareZone ?? '').trim() || null,
      yearlyPassengers
    }

    const additional = validateAndPrepareAdditionalDetails()
    // Ensure URL slug is always present (required).
    const additionalWithSlug = { ...(additional ?? {}), urlSlug }

    setSaving(true)
    try {
      addNewPendingStation(nextStationId, payload, additionalWithSlug)
      setForm(emptyForm())
      setYearlyPassengersRows([])
      setAdditionalForm({})
      setFacilitiesRows([])
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to stage new station')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-content-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add new station</h2>
          <Button
            type="button"
            variant="circle"
            className="modal-close"
            ariaLabel="Close modal"
            onClick={() => handleClose()}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            }
          />
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-detail-item edit-readonly">
              <span className="modal-detail-label">Station ID</span>
              <span className="modal-detail-value">{nextStationId}</span>
            </div>

            <p className="edit-hint">Required fields are marked *</p>

            <div className="edit-form-grid">
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-stationName">Station name *</label>
                <input
                  id="new-stationName"
                  type="text"
                  value={form.stationName ?? ''}
                  onChange={e => update({ stationName: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-crsCode">CRS Code *</label>
                <input
                  id="new-crsCode"
                  type="text"
                  value={form.crsCode ?? ''}
                  onChange={e => update({ crsCode: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-tiploc">Tiploc *</label>
                <input
                  id="new-tiploc"
                  type="text"
                  value={form.tiploc ?? ''}
                  onChange={e => update({ tiploc: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-toc">TOC *</label>
                <input
                  id="new-toc"
                  type="text"
                  value={form.toc ?? ''}
                  onChange={e => update({ toc: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-country">Country *</label>
                <input
                  id="new-country"
                  type="text"
                  value={form.country ?? ''}
                  onChange={e => update({ country: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-county">County *</label>
                <input
                  id="new-county"
                  type="text"
                  value={form.county ?? ''}
                  onChange={e => update({ county: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-stnarea">Station area *</label>
                <input
                  id="new-stnarea"
                  type="text"
                  value={form.stnarea ?? ''}
                  onChange={e => update({ stnarea: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-londonBorough">London Borough</label>
                <input
                  id="new-londonBorough"
                  type="text"
                  value={form.londonBorough ?? ''}
                  onChange={e => update({ londonBorough: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-fareZone">Fare Zone</label>
                <input
                  id="new-fareZone"
                  type="text"
                  value={form.fareZone ?? ''}
                  onChange={e => update({ fareZone: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-latitude">Latitude *</label>
                <input
                  id="new-latitude"
                  type="number"
                  step="any"
                  value={form.latitude ?? 0}
                  onChange={e => update({ latitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-longitude">Longitude *</label>
                <input
                  id="new-longitude"
                  type="number"
                  step="any"
                  value={form.longitude ?? 0}
                  onChange={e => update({ longitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                  className="edit-input"
                />
              </div>
            </div>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Yearly passengers</h3>
            {yearlyPassengersRows.length === 0 && (
              <p className="edit-hint">No yearly passenger rows set.</p>
            )}
            {yearlyPassengersRows.map((row, idx) => (
              <div key={`${idx}-${row.year}`} className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor={`new-year-${idx}`}>Year</label>
                  <input
                    id={`new-year-${idx}`}
                    type="text"
                    value={row.year}
                    onChange={(e) => {
                      const v = e.target.value
                      setYearlyPassengersRows(prev => prev.map((r, i) => (i === idx ? { ...r, year: v } : r)))
                    }}
                    className="edit-input"
                    placeholder="e.g. 2021"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor={`new-passengers-${idx}`}>Passengers</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      id={`new-passengers-${idx}`}
                      type="text"
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value
                        setYearlyPassengersRows(prev => prev.map((r, i) => (i === idx ? { ...r, value: v } : r)))
                      }}
                      className="edit-input"
                      placeholder="e.g. 123456"
                      style={{ flex: 1 }}
                    />
                    <Button
                      type="button"
                      variant="circle"
                      ariaLabel="Remove yearly passenger row"
                      onClick={() => setYearlyPassengersRows(prev => prev.filter((_, i) => i !== idx))}
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
            <Button
              type="button"
              variant="wide"
              width="hug"
              onClick={() => setYearlyPassengersRows(prev => [...prev, { year: '', value: '' }])}
            >
              + Add year
            </Button>
          </div>

          <div className="modal-section">
            <h3 className="modal-section-title">Additional details</h3>
            <div className="edit-form-grid">
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-operatorCode">Operator Code</label>
                <input
                  id="new-operatorCode"
                  type="text"
                  value={String(additionalForm.operatorCode ?? '')}
                  onChange={e => updateAdditional({ operatorCode: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-staffingLevel">Staffing Level</label>
                <input
                  id="new-staffingLevel"
                  type="text"
                  value={String(additionalForm.staffingLevel ?? '')}
                  onChange={e => updateAdditional({ staffingLevel: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-nlc">NLC</label>
                <input
                  id="new-nlc"
                  type="text"
                  value={String(additionalForm.nlc ?? '')}
                  onChange={e => updateAdditional({ nlc: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-minConnectionTime">Min connection time</label>
                <input
                  id="new-minConnectionTime"
                  type="text"
                  value={String((additionalForm['min-connection-time'] as unknown) ?? '')}
                  onChange={e => updateAdditional({ 'min-connection-time': e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field edit-field-full">
                <label className="edit-label" htmlFor="new-urlSlug">URL slug *</label>
                <input
                  id="new-urlSlug"
                  type="text"
                  value={String(additionalForm.urlSlug ?? '')}
                  onChange={e => updateAdditional({ urlSlug: e.target.value })}
                  className="edit-input"
                />
              </div>
            </div>

            <div className="modal-section">
              <h4 className="modal-section-title">Toilets</h4>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-toiletsAccessible">Accessible</label>
                  <input
                    id="new-toiletsAccessible"
                    type="text"
                    value={String(additionalForm.toilets?.toiletsAccessible ?? '')}
                    onChange={e => updateAdditionalNested('toilets', { toiletsAccessible: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-toiletsChangingPlace">Changing Place</label>
                  <input
                    id="new-toiletsChangingPlace"
                    type="text"
                    value={String(additionalForm.toilets?.toiletsChangingPlace ?? '')}
                    onChange={e => updateAdditionalNested('toilets', { toiletsChangingPlace: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-toiletsBabyChanging">Baby changing</label>
                  <input
                    id="new-toiletsBabyChanging"
                    type="text"
                    value={String(additionalForm.toilets?.toiletsBabyChanging ?? '')}
                    onChange={e => updateAdditionalNested('toilets', { toiletsBabyChanging: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h4 className="modal-section-title">Step-free access</h4>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-stepFreeCode">Code</label>
                  <input
                    id="new-stepFreeCode"
                    type="text"
                    value={String(additionalForm.stepFree?.stepFreeCode ?? '')}
                    onChange={e => updateAdditionalNested('stepFree', { stepFreeCode: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="new-stepFreeNote">Note</label>
                  <input
                    id="new-stepFreeNote"
                    type="text"
                    value={String(additionalForm.stepFree?.stepFreeNote ?? '')}
                    onChange={e => updateAdditionalNested('stepFree', { stepFreeNote: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h4 className="modal-section-title">Lift</h4>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-liftAvailable">Available</label>
                  <input
                    id="new-liftAvailable"
                    type="text"
                    value={String(additionalForm.lift?.liftAvailable ?? '')}
                    onChange={e => updateAdditionalNested('lift', { liftAvailable: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="new-liftNotes">Notes</label>
                  <input
                    id="new-liftNotes"
                    type="text"
                    value={String(additionalForm.lift?.liftNotes ?? '')}
                    onChange={e => updateAdditionalNested('lift', { liftNotes: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="new-liftDetails">Details</label>
                  <input
                    id="new-liftDetails"
                    type="text"
                    value={String(additionalForm.lift?.liftDetails ?? '')}
                    onChange={e => updateAdditionalNested('lift', { liftDetails: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h4 className="modal-section-title">Connections</h4>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-connectionBus">Bus</label>
                  <input
                    id="new-connectionBus"
                    type="text"
                    value={String(additionalForm.connections?.connectionBus ?? '')}
                    onChange={e => updateAdditionalNested('connections', { connectionBus: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-connectionTaxi">Taxi</label>
                  <input
                    id="new-connectionTaxi"
                    type="text"
                    value={String(additionalForm.connections?.connectionTaxi ?? '')}
                    onChange={e => updateAdditionalNested('connections', { connectionTaxi: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-connectionUnderground">Underground</label>
                  <input
                    id="new-connectionUnderground"
                    type="text"
                    value={String(additionalForm.connections?.connectionUnderground ?? '')}
                    onChange={e => updateAdditionalNested('connections', { connectionUnderground: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h4 className="modal-section-title">Service</h4>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-requestStop">Request stop</label>
                  <input
                    id="new-requestStop"
                    type="text"
                    value={String(additionalForm.is?.isrequeststop ?? '')}
                    onChange={e => updateAdditionalNested('is', { isrequeststop: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="new-limitedService">Limited service</label>
                  <input
                    id="new-limitedService"
                    type="text"
                    value={String(additionalForm.is?.Islimitedservice ?? '')}
                    onChange={e => updateAdditionalNested('is', { Islimitedservice: e.target.value })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>

            <div className="modal-section">
              <h4 className="modal-section-title">Facilities</h4>
              {facilitiesRows.length === 0 && (
                <p className="edit-hint">No facilities set for this station.</p>
              )}
              {facilitiesRows.length > 0 && (
                <div className="edit-form-grid">
                  {facilitiesRows.map((row, idx) => {
                    const label = row.key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/[_-]+/g, ' ')
                      .replace(/^./, (s) => s.toUpperCase())
                    return (
                      <div key={`${idx}-${row.key}`} className="edit-field">
                        <label className="edit-label" htmlFor={`new-facility-${idx}`}>{label}</label>
                        <input
                          id={`new-facility-${idx}`}
                          type="text"
                          value={row.value}
                          onChange={(e) => {
                            const v = e.target.value
                            setFacilitiesRows(prev => prev.map((r, i) => (i === idx ? { ...r, value: v } : r)))
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
          </div>

          {saveError && (
            <div className="edit-error" role="alert">
              {saveError}
            </div>
          )}

          <div className="modal-edit-actions">
            <Button
              type="button"
              variant="wide"
              width="hug"
              className="edit-cancel-button"
              onClick={() => handleClose()}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="wide"
              width="hug"
              className="edit-save-button"
              onClick={() => handleSave()}
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create station'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewStationModal

