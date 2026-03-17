import React, { useState, useEffect } from 'react'
import type { Station, SandboxStationDoc } from '../types'
import { useStationCollection } from '../contexts/StationCollectionContext'
import { formatFareZoneDisplay } from '../utils/formatFareZone'
import { fetchStationDocumentById } from '../services/firebase'
import Button from './Button'
import './StationModal.css'

interface StationModalProps {
  station: Station | null
  isOpen: boolean
  onClose: () => void
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return 'N/A'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Get London borough from station or raw doc (tries common field names). */
const getLondonBorough = (station: Station | null, doc: Record<string, unknown> | null | undefined): string | null => {
  if (station?.londonBorough) return station.londonBorough
  if (!doc) return null
  let v: unknown =
    doc.londonBorough ??
    doc['London Borough'] ??
    doc.LondonBorough ??
    doc.london_borough ??
    doc.borough ??
    doc.Borough
  if (v == null || v === '') {
    const addr = doc.address
    if (typeof addr === 'object' && addr !== null) {
      const a = addr as Record<string, unknown>
      v = a.borough ?? a.londonBorough ?? a['London Borough']
    }
  }
  if (v == null || v === '') return null
  return String(v)
}

/** Get fare zone from station or raw doc (tries common field names). */
const getFareZone = (station: Station | null, doc: Record<string, unknown> | null | undefined): string | null => {
  if (station?.fareZone) return station.fareZone
  if (!doc) return null
  const v = doc.fareZone ?? doc.fare_zone ?? doc.FareZone ?? doc['Fare Zone'] ?? doc.farezone
  if (v == null || v === '') return null
  return String(v)
}

const StationModal: React.FC<StationModalProps> = ({ station, isOpen, onClose }) => {
  const { collectionId } = useStationCollection()
  const [sandboxDoc, setSandboxDoc] = useState<SandboxStationDoc | null>(null)
  const [sandboxLoading, setSandboxLoading] = useState(false)

  const isSandbox = collectionId === 'newsandboxstations1'

  useEffect(() => {
    if (!isOpen || !station) {
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
  }, [isOpen, station, collectionId])

  if (!isOpen || !station) return null

  const formatYearlyPassengers = (passengers: Record<string, number> | number | string | null | Record<string, number | null>): string => {
    if (!passengers) return 'N/A'

    if (typeof passengers === 'number') {
      return passengers.toLocaleString()
    }

    if (typeof passengers === 'object') {
      const years = Object.keys(passengers).filter((k) => /^\d{4}$/.test(k))
      if (years.length > 0) {
        const sortedYears = years.sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
        const yearEntries = sortedYears.map((year) => {
          const count = (passengers as Record<string, number | null>)[year]
          if (typeof count === 'number') {
            return `${year}: ${count.toLocaleString()}`
          }
          return `${year}: N/A`
        })
        return yearEntries.join('\n')
      }

      const possibleKeys = ['value', 'count', 'total', 'passengers', 'number']
      for (const key of possibleKeys) {
        const val = (passengers as Record<string, unknown>)[key]
        if (val !== undefined && typeof val === 'number') {
          return val.toLocaleString()
        }
      }

      return `Object: ${JSON.stringify(passengers).substring(0, 50)}...`
    }

    if (typeof passengers === 'string') {
      const num = parseFloat(passengers)
      if (!isNaN(num)) return num.toLocaleString()
      return passengers
    }

    return 'N/A'
  }

  const hasCoordinates = station.latitude !== 0 && station.longitude !== 0
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${station.latitude},${station.longitude}`
    : null

  // GeoPoint from Firestore can be { _latitude, _longitude } or { latitude, longitude }
  const locationFromSandbox = sandboxDoc?.location as { _latitude?: number; _longitude?: number; latitude?: number; longitude?: number } | undefined
  const geoLat = locationFromSandbox && (locationFromSandbox._latitude ?? locationFromSandbox.latitude)
  const geoLng = locationFromSandbox && (locationFromSandbox._longitude ?? locationFromSandbox.longitude)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{station.stationName || 'Unknown Station'}</h2>
          <Button
            type="button"
            variant="circle"
            className="modal-close"
            ariaLabel="Close modal"
            onClick={() => onClose()}
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
            <h3 className="modal-section-title">Basic Information</h3>
            <div className="modal-details-grid">
              <div className="modal-detail-item">
                <span className="modal-detail-label">Station ID</span>
                <span className="modal-detail-value">{(station.id || sandboxDoc?.id) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">CRS Code</span>
                <span className="modal-detail-value">{(station.crsCode || sandboxDoc?.CrsCode) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">Tiploc</span>
                <span className="modal-detail-value">{(station.tiploc || sandboxDoc?.tiploc) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">TOC</span>
                <span className="modal-detail-value">{(station.toc || sandboxDoc?.TOC) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">Country</span>
                <span className="modal-detail-value">{(station.country || sandboxDoc?.country) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">County</span>
                <span className="modal-detail-value">{(station.county || sandboxDoc?.county) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">Station Area</span>
                <span className="modal-detail-value">{(station.stnarea || sandboxDoc?.stnarea) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">London Borough</span>
                <span className="modal-detail-value">{getLondonBorough(station, sandboxDoc as Record<string, unknown> | undefined) ?? 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">Fare Zone</span>
                <span className="modal-detail-value">{(() => {
                  const z = getFareZone(station, sandboxDoc as Record<string, unknown> | undefined)
                  return z ? (formatFareZoneDisplay(z) || z) : 'N/A'
                })()}</span>
              </div>
              {sandboxDoc && (
                <>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Operator Code</span>
                    <span className="modal-detail-value">{formatValue(sandboxDoc.operatorCode)}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Staffing Level</span>
                    <span className="modal-detail-value">{formatValue(sandboxDoc.staffingLevel)}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">NLC</span>
                    <span className="modal-detail-value">{formatValue(sandboxDoc.nlc)}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">Min connection time</span>
                    <span className="modal-detail-value">{formatValue(sandboxDoc['min-connection-time'])}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="modal-detail-label">URL slug</span>
                    <span className="modal-detail-value">{formatValue(sandboxDoc.urlSlug)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {(hasCoordinates || (isSandbox && geoLat != null && geoLng != null)) && (
            <div className="modal-section">
              <h3 className="modal-section-title">Location</h3>
              <div className="modal-details-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Latitude</span>
                  <span className="modal-detail-value">{(geoLat ?? station.latitude).toFixed(6)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Longitude</span>
                  <span className="modal-detail-value">{(geoLng ?? station.longitude).toFixed(6)}</span>
                </div>
              </div>
              {(googleMapsUrl || (geoLat != null && geoLng != null)) && (
                <Button
                  type="button"
                  variant="wide"
                  width="hug"
                  className="modal-map-link"
                  onClick={() => {
                    const url = googleMapsUrl || `https://www.google.com/maps?q=${geoLat},${geoLng}`
                    window.open(url, '_blank', 'noopener,noreferrer')
                  }}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  }
                >
                  View on Google Maps
                </Button>
              )}
            </div>
          )}

          {sandboxLoading && (
            <div className="modal-section">
              <p className="modal-sandbox-loading">Loading additional details…</p>
            </div>
          )}

          {sandboxDoc?.toilets && (
            <div className="modal-section">
              <h3 className="modal-section-title">Toilets</h3>
              <div className="modal-details-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Accessible</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.toilets.toiletsAccessible)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Changing Place</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.toilets.toiletsChangingPlace)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Baby changing</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.toilets.toiletsBabyChanging)}</span>
                </div>
              </div>
            </div>
          )}

          {sandboxDoc?.stepFree && (
            <div className="modal-section">
              <h3 className="modal-section-title">Step-free access</h3>
              <div className="modal-details-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Code</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.stepFree.stepFreeCode)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Note</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.stepFree.stepFreeNote)}</span>
                </div>
              </div>
            </div>
          )}

          {sandboxDoc?.lift && (
            <div className="modal-section">
              <h3 className="modal-section-title">Lift</h3>
              <div className="modal-details-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Available</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.lift.liftAvailable)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Notes</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.lift.liftNotes)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Details</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.lift.liftDetails)}</span>
                </div>
              </div>
            </div>
          )}

          {sandboxDoc?.connections && (
            <div className="modal-section">
              <h3 className="modal-section-title">Connections</h3>
              <div className="modal-details-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Bus</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.connections.connectionBus)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Taxi</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.connections.connectionTaxi)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Underground</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.connections.connectionUnderground)}</span>
                </div>
              </div>
            </div>
          )}

          {sandboxDoc?.is && (
            <div className="modal-section">
              <h3 className="modal-section-title">Service</h3>
              <div className="modal-details-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Request stop</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.is.isrequeststop)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Limited service</span>
                  <span className="modal-detail-value">{formatValue(sandboxDoc.is.Islimitedservice)}</span>
                </div>
              </div>
            </div>
          )}

          {sandboxDoc?.facilities && (
            <div className="modal-section">
              <h3 className="modal-section-title">Facilities</h3>
              {Object.keys(sandboxDoc.facilities).length === 0 ? (
                <p className="modal-sandbox-loading">No facilities listed for this station.</p>
              ) : (
                <div className="modal-details-grid modal-facilities-grid">
                  {Object.entries(sandboxDoc.facilities).map(([key, value]) => (
                    <div key={key} className="modal-detail-item">
                      <span className="modal-detail-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</span>
                      <span className="modal-detail-value">{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Additional details are shown above when present on the station document */}

          {(station.yearlyPassengers || (isSandbox && sandboxDoc?.yearlyPassengers)) && (
            <div className="modal-section">
              <h3 className="modal-section-title">Passenger Statistics</h3>
              <div className="modal-passengers">
                <span className="modal-detail-label">Yearly Passengers</span>
                <div className="modal-passengers-content" style={{ whiteSpace: 'pre-line' }}>
                  {formatYearlyPassengers(
                    (isSandbox && sandboxDoc?.yearlyPassengers) ? sandboxDoc.yearlyPassengers! : station.yearlyPassengers!
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StationModal
