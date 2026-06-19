import { forwardRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import StationCard from '../cards/StationCard/StationCard'
import { NETWORK_LABELS, isNetworkCollection } from '../../constants/stationCollections'
import { buildStationPath, getStationNetworkCollectionId } from '../../utils/stationAreaSlug'
import { formatStationLocationDisplay } from '../../utils/formatStationLocation'
import type { Station } from '../../types'
import './StationsMapSelectedPanel.css'

interface StationsMapSelectedPanelProps {
  station: Station | null
}

function formatDetail(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '---'
}

function getLatestPassengerEntry(
  passengers: Station['yearlyPassengers']
): { year: string; value: string } | null {
  if (!passengers || typeof passengers !== 'object') return null

  const yearsWithData = Object.keys(passengers)
    .filter((key) => /^\d{4}$/.test(key))
    .filter((key) => typeof passengers[key] === 'number')
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))

  if (yearsWithData.length === 0) return null

  const year = yearsWithData[0]
  const count = passengers[year] as number
  return { year, value: count.toLocaleString() }
}

const StationsMapSelectedPanel = forwardRef<HTMLElement, StationsMapSelectedPanelProps>(
  ({ station }, ref) => {
    const navigate = useNavigate()

    const collectionId = station ? getStationNetworkCollectionId(station) : null
    const networkLabel =
      collectionId != null && isNetworkCollection(collectionId)
        ? NETWORK_LABELS[collectionId]
        : null
    const passengerEntry = useMemo(
      () => (station ? getLatestPassengerEntry(station.yearlyPassengers) : null),
      [station]
    )

    const stationPath = station ? buildStationPath(station, collectionId ?? undefined) : null
    const openStation = () => {
      if (stationPath) {
        navigate(`/stations/${stationPath}`, { state: { returnTo: '/stations/map' } })
      }
    }

    return (
      <aside ref={ref} className="stations-map-selected-panel" aria-label="Selected station">
        {!station ? (
          <p className="stations-map-selected-panel__empty">
            Click a station pin on the map to view its details here.
          </p>
        ) : (
          <>
            <StationCard
              station={station}
              locationDisplay={formatStationLocationDisplay(station)}
              onCardClick={openStation}
              onInfoClick={openStation}
            />
            <dl className="stations-map-selected-panel__details">
              {networkLabel && (
                <div className="stations-map-selected-panel__row">
                  <dt>Network</dt>
                  <dd>{networkLabel}</dd>
                </div>
              )}
              <div className="stations-map-selected-panel__row">
                <dt>CRS code</dt>
                <dd>{formatDetail(station.crsCode)}</dd>
              </div>
              <div className="stations-map-selected-panel__row">
                <dt>TIPLOC</dt>
                <dd>{formatDetail(station.tiploc)}</dd>
              </div>
              {passengerEntry && (
                <div className="stations-map-selected-panel__row">
                  <dt>Passengers ({passengerEntry.year})</dt>
                  <dd>{passengerEntry.value}</dd>
                </div>
              )}
              <div className="stations-map-selected-panel__row">
                <dt>Coordinates</dt>
                <dd>
                  {station.latitude.toFixed(5)}, {station.longitude.toFixed(5)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </aside>
    )
  }
)

StationsMapSelectedPanel.displayName = 'StationsMapSelectedPanel'

export default StationsMapSelectedPanel
