import React, { useState } from 'react'
import type { Station, YearlyPassengers } from '../types'
import './StationModal.css'
import './StationEditModal.css'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'

interface NewStationModalProps {
  isOpen: boolean
  onClose: () => void
  nextStationId: string
}

type NewStationForm = Partial<Station>

const buildDefaultYearlyPassengers = (): YearlyPassengers => {
  const result: YearlyPassengers = {}
  for (let year = 1998; year <= 2025; year += 1) {
    result[String(year)] = null
  }
  return result
}

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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { addNewPendingStation } = usePendingStationChanges()

  if (!isOpen) return null

  const update = (updates: Partial<NewStationForm>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const handleClose = () => {
    if (saving) return
    setForm(emptyForm())
    setSaveError(null)
    onClose()
  }

  const handleSave = async () => {
    setSaveError(null)

    const name = (form.stationName ?? '').trim()
    const crs = (form.crsCode ?? '').trim()

    if (!name || !crs) {
      setSaveError('Station name and CRS code are required')
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

    const payload: Partial<Station> = {
      stationName: name,
      crsCode: crs,
      tiploc: (form.tiploc ?? '').trim() || null,
      latitude: lat,
      longitude: lng,
      country: (form.country ?? '').trim() || null,
      county: (form.county ?? '').trim() || null,
      toc: (form.toc ?? '').trim() || null,
      stnarea: (form.stnarea ?? '').trim() || null,
      londonBorough: (form.londonBorough ?? '').trim() || null,
      fareZone: (form.fareZone ?? '').trim() || null,
      yearlyPassengers: buildDefaultYearlyPassengers()
    }

    setSaving(true)
    try {
      addNewPendingStation(nextStationId, payload)
      setForm(emptyForm())
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
          <button className="modal-close" onClick={handleClose} aria-label="Close modal" type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-detail-item edit-readonly">
              <span className="modal-detail-label">Station ID</span>
              <span className="modal-detail-value">{nextStationId}</span>
            </div>

            <div className="edit-form-grid">
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-stationName">Station name</label>
                <input
                  id="new-stationName"
                  type="text"
                  value={form.stationName ?? ''}
                  onChange={e => update({ stationName: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-crsCode">CRS Code</label>
                <input
                  id="new-crsCode"
                  type="text"
                  value={form.crsCode ?? ''}
                  onChange={e => update({ crsCode: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-tiploc">Tiploc</label>
                <input
                  id="new-tiploc"
                  type="text"
                  value={form.tiploc ?? ''}
                  onChange={e => update({ tiploc: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-toc">TOC</label>
                <input
                  id="new-toc"
                  type="text"
                  value={form.toc ?? ''}
                  onChange={e => update({ toc: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-country">Country</label>
                <input
                  id="new-country"
                  type="text"
                  value={form.country ?? ''}
                  onChange={e => update({ country: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-county">County</label>
                <input
                  id="new-county"
                  type="text"
                  value={form.county ?? ''}
                  onChange={e => update({ county: e.target.value })}
                  className="edit-input"
                />
              </div>
              <div className="edit-field">
                <label className="edit-label" htmlFor="new-stnarea">Station area</label>
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
                <label className="edit-label" htmlFor="new-latitude">Latitude</label>
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
                <label className="edit-label" htmlFor="new-longitude">Longitude</label>
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

            <p className="edit-hint">
              Yearly passengers will be initialised for 1998–2025 with values set to N/A. You can edit them later in the
              station editor.
            </p>
            <p className="edit-hint">
              Additional sandbox-only details (toilets, step-free access, lifts, connections, facilities, etc.) are managed in
              the sandbox source data and will appear in the View modal once available for this station.
            </p>
          </div>

          {saveError && (
            <div className="edit-error" role="alert">
              {saveError}
            </div>
          )}

          <div className="modal-edit-actions">
            <button
              type="button"
              className="edit-cancel-button"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="edit-save-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create station'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewStationModal

