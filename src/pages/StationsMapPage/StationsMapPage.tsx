import React, { useCallback, useEffect, useRef, useState } from 'react'
import { PageTopHeader } from '../../components/misc'
import BetaTag from '../../components/misc/BetaTag/BetaTag'
import { BUTWideButton } from '../../components/buttons'
import NetworkStationTabGroup from '../../components/cards/NetworkStationTabGroup/NetworkStationTabGroup'
import StationsOsmMap from '../../components/maps/StationsOsmMap'
import StationsMapSelectedPanel from '../../components/maps/StationsMapSelectedPanel'
import { useStationCollection } from '../../contexts/StationCollectionContext'
import { fetchAllNetworkStationsFromFirebase } from '../../services/firebase'
import { getStationMapKey } from '../../utils/stationAreaSlug'
import type { Station } from '../../types'
import '../StationsPageRefactored/StationsPageRefactored.css'
import './StationsMapPage.css'

const MOBILE_MAP_MEDIA = '(max-width: 639px)'

const StationsMapPage: React.FC = () => {
  const { networkView, setNetworkView } = useStationCollection()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const loadStations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAllNetworkStationsFromFirebase()
      setStations(data)
    } catch (err) {
      console.error('Failed to load stations for map:', err)
      setError('Unable to load station data for the map. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStations()
  }, [loadStations])

  useEffect(() => {
    if (!selectedStation) return
    if (networkView === 'all') return
    if (selectedStation.sourceCollectionId !== networkView) {
      setSelectedStation(null)
    }
  }, [networkView, selectedStation])

  useEffect(() => {
    if (!selectedStation) return
    if (!window.matchMedia(MOBILE_MAP_MEDIA).matches) return

    const frameId = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [selectedStation])

  const handleStationSelect = useCallback((station: Station) => {
    setSelectedStation(station)
  }, [])

  const handleStationClear = useCallback(() => {
    setSelectedStation(null)
  }, [])

  if (loading) {
    return (
      <div className="stations-page stations-map-page">
        <div className="stations-loading">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading data from Cloud Database...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stations-page stations-map-page">
        <div className="stations-error">
          <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2>Failed to load stations</h2>
          <p>{error}</p>
          <BUTWideButton onClick={() => void loadStations()} width="hug">
            Try Again
          </BUTWideButton>
        </div>
      </div>
    )
  }

  return (
    <div className="stations-page stations-map-page">
      <PageTopHeader title="Map" titleAddon={<BetaTag />} />
      <div className="stations-toolbar-band">
        <div className="stations-network-tabs-wrap stations-network-tabs-wrap--toolbar">
          <NetworkStationTabGroup value={networkView} onChange={setNetworkView} />
        </div>
      </div>
      <div className="stations-content stations-map-page__content">
        <div className="stations-map-page__layout">
          <main className="stations-main">
            <StationsOsmMap
              stations={stations}
              networkView={networkView}
              selectedStationId={selectedStation ? getStationMapKey(selectedStation) : null}
              onStationSelect={handleStationSelect}
              onStationClear={handleStationClear}
            />
          </main>
          <StationsMapSelectedPanel ref={panelRef} station={selectedStation} />
        </div>
      </div>
    </div>
  )
}

export default StationsMapPage
