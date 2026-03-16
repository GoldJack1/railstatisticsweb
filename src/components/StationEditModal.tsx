import React, { useState, useEffect } from 'react'
import type { Station, YearlyPassengers, SandboxStationDoc } from '../types'
import './StationModal.css'
import './StationEditModal.css'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import { useStationCollection } from '../contexts/StationCollectionContext'
import { fetchStationDocumentById } from '../services/firebase'
import { formatFareZoneDisplay } from '../utils/formatFareZone'

interface StationEditModalProps {
  station: Station | null
  isOpen: boolean
  onClose: () => void
}

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

const StationEditModal: React.FC<StationEditModalProps> = ({ station, isOpen, onClose }) => {
  const [form, setForm] = useState<Partial<Station>>(emptyStationForm)
  const [yearlyPassengersJson, setYearlyPassengersJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [preparedYearlyPassengers, setPreparedYearlyPassengers] = useState<YearlyPassengers | null>(null)
  const { upsertPendingChange } = usePendingStationChanges()
  const { collectionId } = useStationCollection()
  const [sandboxDoc, setSandboxDoc] = useState<SandboxStationDoc | null>(null)
  const [sandboxLoading, setSandboxLoading] = useState(false)
  const isSandbox = collectionId === 'newsandboxstations1'

  useEffect(() => {
    if (!station) {
      setForm(emptyStationForm())
      setYearlyPassengersJson('')
      setSaveError(null)
      setIsReviewing(false)
      setPreparedYearlyPassengers(null)
      return
    }
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
    setYearlyPassengersJson(
      station.yearlyPassengers && typeof station.yearlyPassengers === 'object'
        ? JSON.stringify(station.yearlyPassengers, null, 2)
        : ''
    )
    setSaveError(null)
    setIsReviewing(false)
    setPreparedYearlyPassengers(
      station.yearlyPassengers && typeof station.yearlyPassengers === 'object' && !Array.isArray(station.yearlyPassengers)
        ? (station.yearlyPassengers as YearlyPassengers)
        : null
    )
  }, [station])

  useEffect(() => {
    if (!isOpen || !station || !isSandbox) {
      setSandboxDoc(null)
      return
    }
    let cancelled = false
    setSandboxLoading(true)
    setSandboxDoc(null)
    fetchStationDocumentById(station.id)
      .then((data) => {
        if (!cancelled && data) setSandboxDoc(data as SandboxStationDoc)
      })
      .finally(() => {
        if (!cancelled) setSandboxLoading(false)
      })
    return () => { cancelled = true }
  }, [isOpen, isSandbox, station?.id])

  if (!isOpen || !station) return null

  const update = (updates: Partial<Station>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const validateAndPrepareYearlyPassengers = (): YearlyPassengers | null | 'error' => {
    setSaveError(null)
    let yearlyPassengers: YearlyPassengers | null = null
    if (yearlyPassengersJson.trim()) {
      try {
        const parsed = JSON.parse(yearlyPassengersJson)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          yearlyPassengers = parsed
        }
      } catch {
        setSaveError('Yearly passengers must be valid JSON (e.g. {"2020": 12345, "2021": 67890})')
        return 'error'
      }
    }
    return yearlyPassengers
  }

  const handleBeginReview = () => {
    const result = validateAndPrepareYearlyPassengers()
    if (result === 'error') {
      return
    }
    setPreparedYearlyPassengers(result as YearlyPassengers | null)
    setIsReviewing(true)
  }

  const handlePublish = async () => {
    const yearlyPassengers =
      preparedYearlyPassengers !== null ? preparedYearlyPassengers : validateAndPrepareYearlyPassengers()
    if (yearlyPassengers === 'error') {
      setIsReviewing(false)
      return
    }

    setSaving(true)
    try {
      const lat = typeof form.latitude === 'number' ? form.latitude : parseFloat(String(form.latitude)) || 0
      const lng = typeof form.longitude === 'number' ? form.longitude : parseFloat(String(form.longitude)) || 0

      upsertPendingChange(station, {
        stationName: form.stationName ?? '',
        crsCode: form.crsCode ?? '',
        tiploc: form.tiploc || null,
        latitude: lat,
        longitude: lng,
        country: form.country || null,
        county: form.county || null,
        toc: form.toc || null,
        stnarea: form.stnarea || null,
        londonBorough: form.londonBorough || null,
        fareZone: form.fareZone || null,
        yearlyPassengers
      })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setIsReviewing(false)
    setPreparedYearlyPassengers(null)
    onClose()
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
      if (fromStr !== toStr) {
        changes.push({ label, from: fromStr, to: toStr })
      }
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
        : yearlyPassengersJson.trim()
    if (originalPassengers !== newPassengers) {
      changes.push({
        label: 'Yearly passengers',
        from: originalPassengers || '—',
        to: newPassengers || '—'
      })
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-content-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit: {station.stationName || 'Station'}</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal" type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {!isReviewing ? (
            <div className="modal-section">
              <div className="modal-detail-item edit-readonly">
                <span className="modal-detail-label">Station ID</span>
                <span className="modal-detail-value">{station.id}</span>
              </div>

              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-stationName">Station name</label>
                  <input
                    id="edit-stationName"
                    type="text"
                    value={form.stationName ?? ''}
                    onChange={e => update({ stationName: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-crsCode">CRS Code</label>
                  <input
                    id="edit-crsCode"
                    type="text"
                    value={form.crsCode ?? ''}
                    onChange={e => update({ crsCode: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-tiploc">Tiploc</label>
                  <input
                    id="edit-tiploc"
                    type="text"
                    value={form.tiploc ?? ''}
                    onChange={e => update({ tiploc: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-toc">TOC</label>
                  <input
                    id="edit-toc"
                    type="text"
                    value={form.toc ?? ''}
                    onChange={e => update({ toc: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-country">Country</label>
                  <input
                    id="edit-country"
                    type="text"
                    value={form.country ?? ''}
                    onChange={e => update({ country: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-county">County</label>
                  <input
                    id="edit-county"
                    type="text"
                    value={form.county ?? ''}
                    onChange={e => update({ county: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-stnarea">Station area</label>
                  <input
                    id="edit-stnarea"
                    type="text"
                    value={form.stnarea ?? ''}
                    onChange={e => update({ stnarea: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-londonBorough">London Borough</label>
                  <input
                    id="edit-londonBorough"
                    type="text"
                    value={form.londonBorough ?? ''}
                    onChange={e => update({ londonBorough: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-fareZone">Fare Zone</label>
                  <input
                    id="edit-fareZone"
                    type="text"
                    value={form.fareZone ?? ''}
                    onChange={e => update({ fareZone: e.target.value })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-latitude">Latitude</label>
                  <input
                    id="edit-latitude"
                    type="number"
                    step="any"
                    value={form.latitude ?? ''}
                    onChange={e => update({ latitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-longitude">Longitude</label>
                  <input
                    id="edit-longitude"
                    type="number"
                    step="any"
                    value={form.longitude ?? ''}
                    onChange={e => update({ longitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="edit-input"
                  />
                </div>
              </div>

              <div className="edit-field edit-field-full">
                <label className="edit-label" htmlFor="edit-yearlyPassengers">Yearly passengers (JSON)</label>
                <textarea
                  id="edit-yearlyPassengers"
                  value={yearlyPassengersJson}
                  onChange={e => setYearlyPassengersJson(e.target.value)}
                  className="edit-textarea"
                  rows={4}
                  placeholder='{"2020": 12345, "2021": 67890}'
                />
              </div>

              {isSandbox && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Additional sandbox details (read-only)</h3>
                  {sandboxLoading && (
                    <p className="modal-sandbox-loading">Loading sandbox details…</p>
                  )}
                  {sandboxDoc && !sandboxLoading && (
                    <>
                      <div className="modal-details-grid">
                        <div className="modal-detail-item">
                          <span className="modal-detail-label">Operator Code</span>
                          <span className="modal-detail-value">{sandboxDoc.operatorCode ?? 'N/A'}</span>
                        </div>
                        <div className="modal-detail-item">
                          <span className="modal-detail-label">Staffing Level</span>
                          <span className="modal-detail-value">{sandboxDoc.staffingLevel ?? 'N/A'}</span>
                        </div>
                        <div className="modal-detail-item">
                          <span className="modal-detail-label">NLC</span>
                          <span className="modal-detail-value">{sandboxDoc.nlc ?? 'N/A'}</span>
                        </div>
                        <div className="modal-detail-item">
                          <span className="modal-detail-label">Min connection time</span>
                          <span className="modal-detail-value">{sandboxDoc['min-connection-time'] ?? 'N/A'}</span>
                        </div>
                        <div className="modal-detail-item">
                          <span className="modal-detail-label">URL slug</span>
                          <span className="modal-detail-value">{sandboxDoc.urlSlug ?? 'N/A'}</span>
                        </div>
                      </div>

                      {sandboxDoc.toilets && (
                        <div className="modal-section">
                          <h4 className="modal-section-title">Toilets</h4>
                          <div className="modal-details-grid">
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Accessible</span>
                              <span className="modal-detail-value">{sandboxDoc.toilets.toiletsAccessible ?? 'N/A'}</span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Changing Place</span>
                              <span className="modal-detail-value">{sandboxDoc.toilets.toiletsChangingPlace ?? 'N/A'}</span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Baby changing</span>
                              <span className="modal-detail-value">{sandboxDoc.toilets.toiletsBabyChanging ?? 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {sandboxDoc.stepFree && (
                        <div className="modal-section">
                          <h4 className="modal-section-title">Step-free access</h4>
                          <div className="modal-details-grid">
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Code</span>
                              <span className="modal-detail-value">{sandboxDoc.stepFree.stepFreeCode ?? 'N/A'}</span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Note</span>
                              <span className="modal-detail-value">{sandboxDoc.stepFree.stepFreeNote ?? 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {sandboxDoc.lift && (
                        <div className="modal-section">
                          <h4 className="modal-section-title">Lift</h4>
                          <div className="modal-details-grid">
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Available</span>
                              <span className="modal-detail-value">{sandboxDoc.lift.liftAvailable ?? 'N/A'}</span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Notes</span>
                              <span className="modal-detail-value">{sandboxDoc.lift.liftNotes ?? 'N/A'}</span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Details</span>
                              <span className="modal-detail-value">{sandboxDoc.lift.liftDetails ?? 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {sandboxDoc.connections && (
                        <div className="modal-section">
                          <h4 className="modal-section-title">Connections</h4>
                          <div className="modal-details-grid">
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Bus</span>
                              <span className="modal-detail-value">{sandboxDoc.connections.connectionBus ?? 'N/A'}</span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Taxi</span>
                              <span className="modal-detail-value">{sandboxDoc.connections.connectionTaxi ?? 'N/A'}</span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Underground</span>
                              <span className="modal-detail-value">{sandboxDoc.connections.connectionUnderground ?? 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {sandboxDoc.is && (
                        <div className="modal-section">
                          <h4 className="modal-section-title">Service</h4>
                          <div className="modal-details-grid">
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Request stop</span>
                              <span className="modal-detail-value">
                                {String(sandboxDoc.is.isrequeststop ?? 'N/A')}
                              </span>
                            </div>
                            <div className="modal-detail-item">
                              <span className="modal-detail-label">Limited service</span>
                              <span className="modal-detail-value">
                                {String(sandboxDoc.is.Islimitedservice ?? 'N/A')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {sandboxDoc.facilities && Object.keys(sandboxDoc.facilities).length > 0 && (
                        <div className="modal-section">
                          <h4 className="modal-section-title">Facilities</h4>
                          <div className="modal-details-grid modal-facilities-grid">
                            {Object.entries(sandboxDoc.facilities).map(([key, value]) => (
                              <div key={key} className="modal-detail-item">
                                <span className="modal-detail-label">
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                                </span>
                                <span className="modal-detail-value">
                                  {value === null || value === undefined ? 'N/A' : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {!sandboxLoading && !sandboxDoc && (
                    <p className="modal-sandbox-loading">No additional sandbox details for this station.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="modal-section edit-review-section">
              <div className="edit-review-header">
                <h3 className="edit-review-title">Review changes before publishing</h3>
                <p className="edit-review-subtitle">
                  These changes will be published to the currently selected data source.
                </p>
              </div>
              {changes.length === 0 ? (
                <p className="edit-review-empty">
                  No changes detected compared to the current database values.
                </p>
              ) : (
                <ul className="edit-review-list">
                  {changes.map(change => (
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

          <div className="modal-edit-actions">
            <button
              type="button"
              className="edit-cancel-button"
              onClick={isReviewing ? () => setIsReviewing(false) : handleClose}
            >
              {isReviewing ? 'Back to editing' : 'Cancel'}
            </button>
            <button
              type="button"
              className="edit-save-button"
              onClick={isReviewing ? handlePublish : handleBeginReview}
              disabled={saving}
            >
              {saving ? (isReviewing ? 'Saving…' : 'Saving…') : isReviewing ? 'Save changes' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StationEditModal
