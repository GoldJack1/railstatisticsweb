import React, { useState, useEffect } from 'react'
import type { Station, YearlyPassengers } from '../types'
import { updateStationInFirebase } from '../services/firebase'
import './StationModal.css'
import './StationEditModal.css'

interface StationEditModalProps {
  station: Station | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
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

const StationEditModal: React.FC<StationEditModalProps> = ({ station, isOpen, onClose, onSaved }) => {
  const [form, setForm] = useState<Partial<Station>>(emptyStationForm)
  const [yearlyPassengersJson, setYearlyPassengersJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!station) {
      setForm(emptyStationForm())
      setYearlyPassengersJson('')
      setSaveError(null)
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
  }, [station])

  if (!isOpen || !station) return null

  const update = (updates: Partial<Station>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const handleSave = async () => {
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
        return
      }
    }

    setSaving(true)
    try {
      const lat = typeof form.latitude === 'number' ? form.latitude : parseFloat(String(form.latitude)) || 0
      const lng = typeof form.longitude === 'number' ? form.longitude : parseFloat(String(form.longitude)) || 0
      await updateStationInFirebase(station.id, {
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
      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit: {station.stationName || 'Station'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal" type="button">
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
          </div>

          {saveError && (
            <div className="edit-error" role="alert">
              {saveError}
            </div>
          )}

          <div className="modal-edit-actions">
            <button type="button" className="edit-cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="edit-save-button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save to database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StationEditModal
