import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageTopHeader } from '../../components/misc'
import BetaTag from '../../components/misc/BetaTag/BetaTag'
import { BUTBaseButton as Button, BUTWideButton } from '../../components/buttons'
import NetworkStationTabGroup from '../../components/cards/NetworkStationTabGroup/NetworkStationTabGroup'
import StationsOsmMap from '../../components/maps/StationsOsmMap'
import StationsMapSelectedPanel from '../../components/maps/StationsMapSelectedPanel'
import { useStationCollection } from '../../contexts/StationCollectionContext'
import { usePendingStationChanges } from '../../contexts/PendingStationChangesContext'
import { fetchAllNetworkStationsFromFirebase } from '../../services/firebase'
import { getStationMapKey } from '../../utils/stationAreaSlug'
import { mergePendingNewStationsForMap } from '../../utils/pendingMapStations'
import { isValidStationCoordinate } from '../../utils/stationCoordinates'
import { countPendingChangesForCollection } from '../../utils/pendingChangesByCollection'
import { pathnameForReviewPendingSource } from '../../utils/reviewPendingNavigation'
import { useStationAdminMode } from '../../hooks/useStationAdminMode'
import { isNetworkCollection, NETWORK_COLLECTION_IDS } from '../../constants/stationCollections'
import type { NewStationNavigationState } from '../../types/newStationNavigation'
import type { Station } from '../../types'
import '../StationsPageRefactored/StationsPageRefactored.css'
import './StationsMapPage.css'

const MOBILE_MAP_MEDIA = '(max-width: 639px)'

const StationsMapPage: React.FC = () => {
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const isAdminMode = useStationAdminMode()
  const { collectionId, networkView, setNetworkView, isSandbox } = useStationCollection()
  const { pendingChanges } = usePendingStationChanges()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [isAddStationMode, setIsAddStationMode] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isAdminMode) {
      setIsAddStationMode(false)
    }
  }, [isAdminMode])

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

  const handleAddStationAtLocation = useCallback(
    (latitude: number, longitude: number) => {
      const returnTo = '/stations/map?admin=1'

      const state: NewStationNavigationState = {
        latitude,
        longitude,
        returnTo,
        ...(isNetworkCollection(networkView) ? { targetCollectionId: networkView } : {}),
      }

      navigate('/stations/new', { state })
    },
    [navigate, networkView]
  )

  const firestoreMapStations = useMemo(
    () =>
      stations.filter((station) => {
        if (!isValidStationCoordinate(station.latitude, station.longitude)) return false
        if (networkView === 'all') return true
        return station.sourceCollectionId === networkView
      }),
    [stations, networkView]
  )

  const { stations: mapStations, pendingNewKeys } = useMemo(
    () => mergePendingNewStationsForMap(firestoreMapStations, pendingChanges, networkView),
    [firestoreMapStations, pendingChanges, networkView]
  )

  const selectedStationIsPending = Boolean(
    selectedStation && pendingNewKeys.has(getStationMapKey(selectedStation))
  )

  const pendingChangesCount = useMemo(() => {
    if (isSandbox) return countPendingChangesForCollection(pendingChanges, collectionId)
    if (networkView === 'all') {
      return NETWORK_COLLECTION_IDS.reduce(
        (sum, id) => sum + countPendingChangesForCollection(pendingChanges, id),
        0
      )
    }
    return countPendingChangesForCollection(pendingChanges, collectionId)
  }, [pendingChanges, collectionId, networkView, isSandbox])

  const handleOpenPendingChanges = useCallback(() => {
    navigate('/stations/pending-review', {
      state: { from: pathnameForReviewPendingSource(routerLocation) },
    })
  }, [navigate, routerLocation])

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
        <div className="stations-map-page__toolbar-row">
          {isAdminMode && (
            <div className="stations-map-page__admin-actions">
              <Button
                type="button"
                variant="wide"
                width="hug"
                colorVariant={isAddStationMode ? 'accent' : 'primary'}
                aria-pressed={isAddStationMode}
                onClick={() => setIsAddStationMode((active) => !active)}
              >
                Add station mode
              </Button>
              <Button
                type="button"
                variant="wide"
                width="hug"
                colorVariant={pendingChangesCount > 0 ? 'accent' : 'primary'}
                onClick={handleOpenPendingChanges}
              >
                Pending changes ({pendingChangesCount})
              </Button>
            </div>
          )}
          <div className="stations-network-tabs-wrap stations-network-tabs-wrap--toolbar">
            <NetworkStationTabGroup value={networkView} onChange={setNetworkView} />
          </div>
        </div>
      </div>
      <div className="stations-content stations-map-page__content">
        <div className="stations-map-page__layout">
          <main className="stations-main">
            <StationsOsmMap
              stations={mapStations}
              publishedStations={firestoreMapStations}
              pendingNewStationKeys={pendingNewKeys}
              networkView={networkView}
              selectedStationId={selectedStation ? getStationMapKey(selectedStation) : null}
              onStationSelect={handleStationSelect}
              onStationClear={handleStationClear}
              allowAddStation={isAdminMode}
              addStationMode={isAddStationMode}
              onAddStationModeChange={setIsAddStationMode}
              onAddStationAtLocation={handleAddStationAtLocation}
            />
          </main>
          <StationsMapSelectedPanel
            ref={panelRef}
            station={selectedStation}
            isPendingNew={selectedStationIsPending}
          />
        </div>
      </div>
    </div>
  )
}

export default StationsMapPage
