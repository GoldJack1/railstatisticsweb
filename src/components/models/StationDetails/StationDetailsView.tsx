import React, { useEffect } from 'react'
import type { Station, SandboxStationDoc } from '../../../types'
import { formatFareZoneDisplay } from '../../../utils/formatFareZone'
import { readStationUrl, resolveStationUrlHref } from '../../../utils/stationUrlField'
import type { StationCollectionFieldSchema } from '../../../utils/stationCollectionFieldSchema'
import { stationDetailsShowsAdditionalTab, STEP_FREE_SECTION_LABEL } from '../../../utils/stationCollectionFieldSchema'
import { useStationFieldSchema } from '../../../hooks/useStationCollectionFieldSchema'
import { BUTBaseButton as Button } from '../../buttons'
import { StationDetailField } from './StationDetailField'
import { StationPendingChangesBanner } from './StationPendingChangesBanner'
import StationResponsiveLocationMap from './StationResponsiveLocationMap'
import type { StationFieldChange } from '../../../utils/stationFieldDiffs'
import './StationPendingChangesBanner.css'

const BLANK_DISPLAY = '---'

const isBlankValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  return false
}

const formatOptionalText = (value: string | null | undefined): string => {
  if (isBlankValue(value)) return BLANK_DISPLAY
  return String(value)
}

const formatValue = (v: unknown): string => {
  if (isBlankValue(v)) return BLANK_DISPLAY
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Get borough from station or raw doc (tries common field names). */
const getBorough = (station: Station | null, doc: Record<string, unknown> | null | undefined): string | null => {
  if (station?.borough) return station.borough
  if (!doc) return null
  let v: unknown =
    doc.borough ??
    doc.Borough ??
    doc.londonBorough ??
    doc['London Borough'] ??
    doc.LondonBorough ??
    doc.london_borough
  if (v == null || v === '') {
    const addr = doc.address
    if (typeof addr === 'object' && addr !== null) {
      const a = addr as Record<string, unknown>
      v = a.borough ?? a.Borough
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
        return { year, value: BLANK_DISPLAY }
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

import type { StationDetailsTab } from '../../../utils/stationCollectionFieldSchema'

interface StationDetailsViewProps {
  station: Station
  additionalDoc: SandboxStationDoc | null
  additionalLoading?: boolean
  /** When undefined (e.g. in modal), all sections are shown. When set, only that tab's content is shown. */
  activeTab?: StationDetailsTab
  /** Per-network field visibility; inferred from Firestore when omitted. */
  fieldSchema?: StationCollectionFieldSchema
  /** Staged unpublished edits for this station (highlights fields + banner). */
  pendingFieldChanges?: StationFieldChange[]
  isPendingNew?: boolean
}

const StationDetailsView: React.FC<StationDetailsViewProps> = ({
  station,
  additionalDoc,
  additionalLoading,
  activeTab,
  fieldSchema: fieldSchemaProp,
  pendingFieldChanges,
  isPendingNew = false,
}) => {
  const { fieldSchema } = useStationFieldSchema(station, fieldSchemaProp)
  const showAdditionalFields = stationDetailsShowsAdditionalTab(fieldSchema)
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
  const showUsage = fieldSchema.showUsageTab && (showAll || activeTab === 'usage')
  const showAdditional = showAdditionalFields && (showAll || activeTab === 'additional')
  const showStepFree = fieldSchema.showStepFreeTab && (showAll || activeTab === 'stepFree')
  const showService = fieldSchema.showServiceTab && (showAll || activeTab === 'service')
  const showFacilities = fieldSchema.showFacilitiesTab && (showAll || activeTab === 'facilities')

  const stationUrlValue = readStationUrl(
    additionalDoc ?? ({ url: station.stationUrl, urlSlug: station.urlSlug } as Partial<SandboxStationDoc>)
  )
  const stationUrlHref = resolveStationUrlHref(stationUrlValue)

  useEffect(() => {
    if (!showLocationTab || !showLocation) return
    // #region agent log
    fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H4',location:'StationDetailsView.tsx:location-render',message:'Location tab render state',data:{activeTab:activeTab ?? 'all',showLocationTab,showLocation,lat:geoLat ?? station.latitude,lng:geoLng ?? station.longitude},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }, [activeTab, showLocationTab, showLocation, geoLat, geoLng, station.latitude, station.longitude])

  return (
    <>
      {(pendingFieldChanges?.length || isPendingNew) && (
        <StationPendingChangesBanner changes={pendingFieldChanges ?? []} isNew={isPendingNew} />
      )}
      {showDetails && (
        <>
        <div className="modal-section">
          <h3 className="modal-section-title">Details</h3>
          <div className="modal-details-grid modal-facilities-grid">
            <StationDetailField label="Station ID" value={formatOptionalText(station.id)} pendingFieldChanges={pendingFieldChanges} />
            <StationDetailField label="CRS Code" value={formatOptionalText(station.crsCode)} pendingFieldChanges={pendingFieldChanges} />
            <StationDetailField label="Tiploc" value={formatOptionalText(station.tiploc)} pendingFieldChanges={pendingFieldChanges} />
            <StationDetailField label="TOC" value={formatOptionalText(station.toc)} pendingFieldChanges={pendingFieldChanges} />
            <StationDetailField label="Country" value={formatOptionalText(station.country)} pendingFieldChanges={pendingFieldChanges} />
            <StationDetailField label="County" value={formatOptionalText(station.county)} pendingFieldChanges={pendingFieldChanges} />
            <StationDetailField label="Station area" value={formatOptionalText(station.stnarea)} pendingFieldChanges={pendingFieldChanges} />
            {fieldSchema.showBorough && (
              <StationDetailField
                label="Borough"
                value={formatOptionalText(getBorough(station, additionalDoc as Record<string, unknown> | null))}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showFareZone && (
              <StationDetailField
                label="Fare zone"
                value={(() => {
                  const z = getFareZone(station, additionalDoc as Record<string, unknown> | null)
                  if (isBlankValue(z)) return BLANK_DISPLAY
                  return formatFareZoneDisplay(z!) || z || BLANK_DISPLAY
                })()}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showNlc && (
              <StationDetailField label="NLC" value={formatValue(additionalDoc?.nlc)} pendingFieldChanges={pendingFieldChanges} />
            )}
            {fieldSchema.showGauge && (
              <StationDetailField label="Gauge" value={formatValue(additionalDoc?.guage)} pendingFieldChanges={pendingFieldChanges} />
            )}
            {fieldSchema.showUrl && (
              <StationDetailField
                label={fieldSchema.urlFieldLabel}
                value={formatOptionalText(stationUrlValue)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
          </div>
          {fieldSchema.showUrl && stationUrlHref && (
            <Button
              type="button"
              variant="wide"
              width="hug"
              className="modal-map-link"
              onClick={() => window.open(stationUrlHref, '_blank', 'noopener,noreferrer')}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              }
            >
              Open link
            </Button>
          )}
        </div>

        {fieldSchema.showStepFreeSection && (
          <div className="modal-section">
            <h3 className="modal-section-title">{STEP_FREE_SECTION_LABEL}</h3>
            <div className="modal-details-grid">
              <StationDetailField
                label="Step Free Status"
                value={formatValue(additionalDoc?.stepFree?.stepFreeCode)}
                pendingFieldChanges={pendingFieldChanges}
              />
              {fieldSchema.showStepFreeNote && (
                <StationDetailField
                  label="Note"
                  value={formatValue(additionalDoc?.stepFree?.stepFreeNote)}
                  pendingFieldChanges={pendingFieldChanges}
                />
              )}
            </div>
          </div>
        )}
        </>
      )}

      {showLocationTab && showLocation && (
        <div className="modal-section modal-section--location">
          <h3 className="modal-section-title">Location</h3>
          <div className="modal-details-grid modal-facilities-grid">
            <StationDetailField
              label="Latitude"
              value={(geoLat ?? station.latitude).toFixed(6)}
              pendingFieldChanges={pendingFieldChanges}
            />
            <StationDetailField
              label="Longitude"
              value={(geoLng ?? station.longitude).toFixed(6)}
              pendingFieldChanges={pendingFieldChanges}
            />
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
            {fieldSchema.showOperatorCode && (
              <StationDetailField
                label="Operator code"
                value={formatValue(additionalDoc.operatorCode)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showMinConnectionTime && (
              <StationDetailField
                label="Min connection time"
                value={formatValue(additionalDoc['min-connection-time'])}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showProvince && (
              <StationDetailField
                label="Province"
                value={formatValue(additionalDoc.province)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showPostEirCode && (
              <StationDetailField
                label="Post / Eircode"
                value={formatValue(additionalDoc['post-eir_code'])}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
          </div>
        </div>
      )}

      {showFacilities && fieldSchema.showToiletsSection && additionalDoc?.toilets && (
        <div className="modal-section">
          <h3 className="modal-section-title">Toilets</h3>
          <div className="modal-details-grid">
            <StationDetailField
              label="Accessible"
              value={formatValue(additionalDoc.toilets.toiletsAccessible)}
              pendingFieldChanges={pendingFieldChanges}
            />
            <StationDetailField
              label="Changing Place"
              value={formatValue(additionalDoc.toilets.toiletsChangingPlace)}
              pendingFieldChanges={pendingFieldChanges}
            />
            <StationDetailField
              label="Baby changing"
              value={formatValue(additionalDoc.toilets.toiletsBabyChanging)}
              pendingFieldChanges={pendingFieldChanges}
            />
          </div>
        </div>
      )}

      {showStepFree && fieldSchema.showLiftSection && additionalDoc?.lift && (
        <div className="modal-section">
          <h3 className="modal-section-title">Lift</h3>
          <div className="modal-details-grid">
            <StationDetailField
              label="Available"
              value={formatValue(additionalDoc.lift.liftAvailable)}
              pendingFieldChanges={pendingFieldChanges}
            />
            <StationDetailField
              label="Notes"
              value={formatValue(additionalDoc.lift.liftNotes)}
              pendingFieldChanges={pendingFieldChanges}
            />
            <StationDetailField
              label="Details"
              value={formatValue(additionalDoc.lift.liftDetails)}
              pendingFieldChanges={pendingFieldChanges}
            />
          </div>
        </div>
      )}

      {showService &&
        additionalDoc?.connections &&
        (fieldSchema.showConnectionBus ||
          fieldSchema.showConnectionTaxi ||
          fieldSchema.showConnectionUnderground) && (
        <div className="modal-section">
          <h3 className="modal-section-title">Connections</h3>
          <div className="modal-details-grid">
            {fieldSchema.showConnectionBus && (
              <StationDetailField
                label="Bus"
                value={formatValue(additionalDoc.connections.connectionBus)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showConnectionTaxi && (
              <StationDetailField
                label="Taxi"
                value={formatValue(additionalDoc.connections.connectionTaxi)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showConnectionUnderground && (
              <StationDetailField
                label="Underground"
                value={formatValue(additionalDoc.connections.connectionUnderground)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
          </div>
        </div>
      )}

      {showService &&
        (fieldSchema.showStationStatusSection ||
          fieldSchema.showStaffingLevel ||
          fieldSchema.showRequestStop ||
          fieldSchema.showLimitedService) && (
        <div className="modal-section">
          <h3 className="modal-section-title">Service</h3>
          <div className="modal-details-grid">
            {fieldSchema.showStationStatusSection && (
              <>
                <StationDetailField
                  label="Status"
                  value={formatOptionalText(additionalDoc?.stationstatus?.status)}
                  pendingFieldChanges={pendingFieldChanges}
                />
                <StationDetailField
                  label="Operational period"
                  value={formatOptionalText(additionalDoc?.stationstatus?.operationalperiod)}
                  pendingFieldChanges={pendingFieldChanges}
                />
              </>
            )}
            {fieldSchema.showStaffingLevel && (
              <StationDetailField
                label="Staffing level"
                value={formatValue(additionalDoc?.staffingLevel)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showRequestStop && (
              <StationDetailField
                label="Request stop"
                value={formatValue(additionalDoc?.is?.isrequeststop)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
            {fieldSchema.showLimitedService && (
              <StationDetailField
                label="Limited service"
                value={formatValue(additionalDoc?.is?.Islimitedservice)}
                pendingFieldChanges={pendingFieldChanges}
              />
            )}
          </div>
        </div>
      )}

      {showFacilities && fieldSchema.facilityKeys.length > 0 && additionalDoc?.facilities && (
        <div className="modal-section">
          <h3 className="modal-section-title">Facilities</h3>
          <div className="modal-details-grid modal-facilities-grid">
            {fieldSchema.facilityKeys.map((key) => (
              <StationDetailField
                key={key}
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                value={formatValue((additionalDoc.facilities as Record<string, unknown> | undefined)?.[key])}
                pendingFieldChanges={pendingFieldChanges}
              />
            ))}
          </div>
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
              <StationDetailField
                key={entry.year}
                label={entry.year}
                value={entry.value}
                pendingFieldChanges={pendingFieldChanges}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export type { StationDetailsTab } from '../../../utils/stationCollectionFieldSchema'
export default StationDetailsView

