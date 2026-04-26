import React, { useEffect } from 'react'
import type { Station, SandboxStationDoc } from '../../../types'
import { formatFareZoneDisplay } from '../../../utils/formatFareZone'
import { BUTBaseButton as Button } from '../../buttons'
import StationResponsiveLocationMap from './StationResponsiveLocationMap'

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

const getYearlyPassengerEntries = (
  passengers: Record<string, number> | number | string | null | Record<string, number | null>
): Array<{ year: string; value: string }> => {
  if (!passengers) return []

  if (typeof passengers === 'number') {
    return [{ year: 'Total', value: passengers.toLocaleString() }]
  }

  if (typeof passengers === 'object') {
    const years = Object.keys(passengers).filter((k) => /^\d{4}$/.test(k))
    if (years.length > 0) {
      const sortedYears = years.sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
      return sortedYears.map((year) => {
        const count = (passengers as Record<string, number | null>)[year]
        if (typeof count === 'number') {
          return { year, value: count.toLocaleString() }
        }
        return { year, value: 'N/A' }
      })
    }

    const possibleKeys = ['value', 'count', 'total', 'passengers', 'number']
    for (const key of possibleKeys) {
      const val = (passengers as Record<string, unknown>)[key]
      if (val !== undefined && typeof val === 'number') {
        return [{ year: key, value: val.toLocaleString() }]
      }
    }

    return []
  }

  if (typeof passengers === 'string') {
    const num = parseFloat(passengers)
    if (!isNaN(num)) return [{ year: 'Total', value: num.toLocaleString() }]
    return [{ year: 'Total', value: passengers }]
  }

  return []
}

export type StationDetailsTab =
  | 'details'
  | 'location'
  | 'usage'
  | 'additional'
  | 'stepFree'
  | 'service'
  | 'facilities'

interface StationDetailsViewProps {
  station: Station
  additionalDoc: SandboxStationDoc | null
  additionalLoading?: boolean
  /** When undefined (e.g. in modal), all sections are shown. When set, only that tab's content is shown. */
  activeTab?: StationDetailsTab
}

const StationDetailsView: React.FC<StationDetailsViewProps> = ({
  station,
  additionalDoc,
  additionalLoading,
  activeTab,
}) => {
  const hasCoordinates = station.latitude !== 0 && station.longitude !== 0
  const googleMapsUrl = hasCoordinates ? `https://www.google.com/maps?q=${station.latitude},${station.longitude}` : null

  // GeoPoint from Firestore can be { _latitude, _longitude } or { latitude, longitude }
  const locationFromDoc = additionalDoc?.location as
    | { _latitude?: number; _longitude?: number; latitude?: number; longitude?: number }
    | undefined
  const geoLat = locationFromDoc && (locationFromDoc._latitude ?? locationFromDoc.latitude)
  const geoLng = locationFromDoc && (locationFromDoc._longitude ?? locationFromDoc.longitude)

  const showLocation = hasCoordinates || (geoLat != null && geoLng != null)

  const showAll = activeTab === undefined
  const showDetails = showAll || activeTab === 'details'
  const showLocationTab = showAll || activeTab === 'location'
  const showUsage = showAll || activeTab === 'usage'
  const showAdditional = showAll || activeTab === 'additional'
  const showStepFree = showAll || activeTab === 'stepFree'
  const showService = showAll || activeTab === 'service'
  const showFacilities = showAll || activeTab === 'facilities'

  useEffect(() => {
    if (!showLocationTab || !showLocation) return
    // #region agent log
    fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H4',location:'StationDetailsView.tsx:location-render',message:'Location tab render state',data:{activeTab:activeTab ?? 'all',showLocationTab,showLocation,lat:geoLat ?? station.latitude,lng:geoLng ?? station.longitude},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }, [activeTab, showLocationTab, showLocation, geoLat, geoLng, station.latitude, station.longitude])

  return (
    <>
      {showDetails && (
        <div className="modal-section">
          <h3 className="modal-section-title">Details</h3>
          <div className="modal-details-grid modal-facilities-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Station ID</span>
              <span className="modal-detail-value">{station.id ?? 'N/A'}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">CRS Code</span>
              <span className="modal-detail-value">{station.crsCode ?? 'N/A'}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Tiploc</span>
              <span className="modal-detail-value">{station.tiploc ?? 'N/A'}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">TOC</span>
              <span className="modal-detail-value">{station.toc ?? 'N/A'}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Country</span>
              <span className="modal-detail-value">{station.country ?? 'N/A'}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">County</span>
              <span className="modal-detail-value">{station.county ?? 'N/A'}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Station area</span>
              <span className="modal-detail-value">{station.stnarea ?? 'N/A'}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">London Borough</span>
              <span className="modal-detail-value">
                {getLondonBorough(station, additionalDoc as Record<string, unknown> | null) ?? 'N/A'}
              </span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Fare zone</span>
              <span className="modal-detail-value">
                {(() => {
                  const z = getFareZone(station, additionalDoc as Record<string, unknown> | null)
                  return z ? (formatFareZoneDisplay(z) || z) : 'N/A'
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {showLocationTab && showLocation && (
        <div className="modal-section modal-section--location">
          <h3 className="modal-section-title">Location</h3>
          <div className="modal-details-grid modal-facilities-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Latitude</span>
              <span className="modal-detail-value">{(geoLat ?? station.latitude).toFixed(6)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Longitude</span>
              <span className="modal-detail-value">{(geoLng ?? station.longitude).toFixed(6)}</span>
            </div>
          </div>
          {(googleMapsUrl || (geoLat != null && geoLng != null)) && (() => {
            const lat = geoLat ?? station.latitude
            const lng = geoLng ?? station.longitude
            const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17`
            return (
              <>
                <Button
                  type="button"
                  variant="wide"
                  width="hug"
                  className="modal-map-link"
                  onClick={() => window.open(osmUrl, '_blank', 'noopener,noreferrer')}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  }
                >
                  View on OpenStreetMap
                </Button>
                <div className="station-details-location-map-wrap">
                  <StationResponsiveLocationMap
                    latitude={lat}
                    longitude={lng}
                  />
                </div>
              </>
            )
          })()}
        </div>
      )}

      {showAdditional && additionalLoading && (
        <div className="modal-section">
          <p className="modal-sandbox-loading">Loading additional details…</p>
        </div>
      )}

      {showAdditional && !additionalLoading && !additionalDoc && (
        <div className="modal-section">
          <p className="modal-sandbox-loading">No additional details found for this station.</p>
        </div>
      )}

      {showAdditional && additionalDoc && (
        <div className="modal-section">
          <h3 className="modal-section-title">Additional details</h3>
          <div className="modal-details-grid modal-facilities-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Operator code</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.operatorCode)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Staffing level</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.staffingLevel)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">NLC</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.nlc)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Min connection time</span>
              <span className="modal-detail-value">{formatValue(additionalDoc['min-connection-time'])}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">URL slug</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.urlSlug)}</span>
            </div>
          </div>
        </div>
      )}

      {showFacilities && additionalDoc?.toilets && (
        <div className="modal-section">
          <h3 className="modal-section-title">Toilets</h3>
          <div className="modal-details-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Accessible</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.toilets.toiletsAccessible)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Changing Place</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.toilets.toiletsChangingPlace)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Baby changing</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.toilets.toiletsBabyChanging)}</span>
            </div>
          </div>
        </div>
      )}

      {showStepFree && additionalDoc?.stepFree && (
        <div className="modal-section">
          <h3 className="modal-section-title">Step-free & Lift access</h3>
          <div className="modal-details-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Code</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.stepFree.stepFreeCode)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Note</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.stepFree.stepFreeNote)}</span>
            </div>
          </div>
        </div>
      )}

      {showStepFree && additionalDoc?.lift && (
        <div className="modal-section">
          <h3 className="modal-section-title">Lift</h3>
          <div className="modal-details-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Available</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.lift.liftAvailable)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Notes</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.lift.liftNotes)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Details</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.lift.liftDetails)}</span>
            </div>
          </div>
        </div>
      )}

      {showService && additionalDoc?.connections && (
        <div className="modal-section">
          <h3 className="modal-section-title">Connections</h3>
          <div className="modal-details-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Bus</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.connections.connectionBus)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Taxi</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.connections.connectionTaxi)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Underground</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.connections.connectionUnderground)}</span>
            </div>
          </div>
        </div>
      )}

      {showService && additionalDoc?.is && (
        <div className="modal-section">
          <h3 className="modal-section-title">Service</h3>
          <div className="modal-details-grid">
            <div className="modal-detail-item">
              <span className="modal-detail-label">Request stop</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.is.isrequeststop)}</span>
            </div>
            <div className="modal-detail-item">
              <span className="modal-detail-label">Limited service</span>
              <span className="modal-detail-value">{formatValue(additionalDoc.is.Islimitedservice)}</span>
            </div>
          </div>
        </div>
      )}

      {showFacilities && additionalDoc?.facilities && (
        <div className="modal-section">
          <h3 className="modal-section-title">Facilities</h3>
          {Object.keys(additionalDoc.facilities).length === 0 ? (
            <p className="modal-sandbox-loading">No facilities listed for this station.</p>
          ) : (
            <div className="modal-details-grid modal-facilities-grid">
              {Object.entries(additionalDoc.facilities).map(([key, value]) => (
                <div key={key} className="modal-detail-item">
                  <span className="modal-detail-label">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  </span>
                  <span className="modal-detail-value">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showUsage && (station.yearlyPassengers || additionalDoc?.yearlyPassengers) && (
        <div className="modal-section">
          <h3 className="modal-section-title">Usage</h3>
          <div className="modal-details-grid modal-facilities-grid">
            {getYearlyPassengerEntries(
              (additionalDoc?.yearlyPassengers as Record<string, number> | number | null) ??
                (station.yearlyPassengers as Record<string, number> | number | null)
            ).map((entry) => (
              <div key={entry.year} className="modal-detail-item">
                <span className="modal-detail-label">{entry.year}</span>
                <span className="modal-detail-value">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default StationDetailsView

