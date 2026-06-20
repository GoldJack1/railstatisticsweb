import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  NETWORK_COLLECTION_IDS,
  NETWORK_LABELS,
  isNetworkCollection,
  type NetworkCollectionId,
  type NetworkViewFilter,
} from '../../constants/stationCollections'
import {
  NETWORK_MAP_COLORS,
  NETWORK_MAP_FALLBACK_COLOR,
  PENDING_NEW_STATION_MAP_COLOR,
  SELECTED_MARKER_BORDER_COLOR,
} from '../../constants/stationNetworkMapColors'
import { useTheme } from '../../hooks/useTheme'
import { getStationNetworkCollectionId, getStationMapKey } from '../../utils/stationAreaSlug'
import { isValidStationCoordinate } from '../../utils/stationCoordinates'
import {
  createSuperTramMapDivIcon,
  isSuperTramMapStop,
} from '../../utils/superTramMapMarker'
import { getMarkerHitRadius, getMarkerVisualRadius } from '../../utils/mapMarkerSizing'
import { getTileLayersConfig } from '../../utils/mapTiles'
import type { Station } from '../../types'
import {
  MapAddStationContextMenu,
  type MapAddStationContextMenuState,
} from './MapAddStationContextMenu'
import './StationsOsmMap.css'

const DEFAULT_CENTER: L.LatLngTuple = [54.5, -2.5]
const DEFAULT_ZOOM = 6
const MAP_PADDING: L.PointExpression = [48, 48]
const MOBILE_MAP_MEDIA = '(max-width: 639px)'

type StationMarkerPair = {
  hit: L.CircleMarker
  visual: L.CircleMarker | L.Marker
  kind: 'circle' | 'supertram-logo'
}

function isMobileMapViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MAP_MEDIA).matches
}

function getMarkerRadii(isSelected: boolean, mobile: boolean) {
  return {
    visual: getMarkerVisualRadius(isSelected, mobile),
    hit: getMarkerHitRadius(isSelected, mobile),
  }
}

interface StationsOsmMapProps {
  stations: Station[]
  /** Published Firestore stations only — used for initial map bounds (excludes pending new). */
  publishedStations: Station[]
  pendingNewStationKeys?: ReadonlySet<string>
  networkView: NetworkViewFilter
  selectedStationId: string | null
  onStationSelect: (station: Station) => void
  onStationClear: () => void
  allowAddStation?: boolean
  /** Crosshair mode — click the map to place a new station. */
  addStationMode?: boolean
  onAddStationAtLocation?: (latitude: number, longitude: number) => void
  onAddStationModeChange?: (enabled: boolean) => void
}

function getStationLegendCollectionId(
  station: Station,
  networkView: NetworkViewFilter
): NetworkCollectionId | null {
  const collectionId =
    station.sourceCollectionId && isNetworkCollection(station.sourceCollectionId)
      ? station.sourceCollectionId
      : getStationNetworkCollectionId(station, networkView !== 'all' ? networkView : undefined)

  return collectionId && isNetworkCollection(collectionId) ? collectionId : null
}

function getStationMarkerColor(
  station: Station,
  networkView: NetworkViewFilter,
  pendingNewStationKeys: ReadonlySet<string>
): string {
  if (pendingNewStationKeys.has(getStationMapKey(station))) {
    return PENDING_NEW_STATION_MAP_COLOR
  }

  const collectionId = getStationLegendCollectionId(station, networkView)
  if (collectionId) {
    return NETWORK_MAP_COLORS[collectionId]
  }
  return NETWORK_MAP_FALLBACK_COLOR
}

function applyMarkerStyle(
  marker: StationMarkerPair,
  station: Station,
  networkView: NetworkViewFilter,
  pendingNewStationKeys: ReadonlySet<string>,
  isSelected: boolean,
  mobile: boolean
): void {
  const { visual, hit } = getMarkerRadii(isSelected, mobile)
  const isPendingNew = pendingNewStationKeys.has(getStationMapKey(station))

  marker.hit.setStyle({
    radius: hit,
    fillOpacity: 0.001,
    stroke: false,
    weight: 0,
  })

  if (marker.kind === 'supertram-logo') {
    const iconMarker = marker.visual as L.Marker
    iconMarker.setIcon(createSuperTramMapDivIcon(isSelected, mobile, isPendingNew))
    iconMarker.setZIndexOffset(isSelected ? 1000 : 0)
    return
  }

  const circleMarker = marker.visual as L.CircleMarker
  circleMarker.setStyle({
    radius: visual,
    fillColor: getStationMarkerColor(station, networkView, pendingNewStationKeys),
    color: isSelected ? SELECTED_MARKER_BORDER_COLOR : '#ffffff',
    weight: isSelected ? 3 : 2,
    fillOpacity: 0.95,
  })
}

export function StationsOsmMap({
  stations,
  publishedStations,
  pendingNewStationKeys = new Set<string>(),
  networkView,
  selectedStationId,
  onStationSelect,
  onStationClear,
  allowAddStation = false,
  addStationMode = false,
  onAddStationAtLocation,
  onAddStationModeChange,
}: StationsOsmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const markersByIdRef = useRef<Map<string, StationMarkerPair>>(new Map())
  const onStationSelectRef = useRef(onStationSelect)
  const onStationClearRef = useRef(onStationClear)
  const allowAddStationRef = useRef(allowAddStation)
  const addStationModeRef = useRef(addStationMode)
  const onAddStationAtLocationRef = useRef(onAddStationAtLocation)
  const onAddStationModeChangeRef = useRef(onAddStationModeChange)
  const [addStationMenu, setAddStationMenu] = useState<MapAddStationContextMenuState | null>(null)
  const [mobileMarkers, setMobileMarkers] = useState(isMobileMapViewport)
  const [visibleLegendNetworks, setVisibleLegendNetworks] = useState<NetworkCollectionId[]>([])
  const { theme } = useTheme()
  const themeKey = theme === 'dark' ? 'dark' : 'light'
  const tileLayers = getTileLayersConfig()

  onStationSelectRef.current = onStationSelect
  onStationClearRef.current = onStationClear
  allowAddStationRef.current = allowAddStation
  addStationModeRef.current = addStationMode
  onAddStationAtLocationRef.current = onAddStationAtLocation
  onAddStationModeChangeRef.current = onAddStationModeChange

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MAP_MEDIA)
    const onChange = () => setMobileMarkers(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  const mapStations = useMemo(
    () =>
      stations.filter((station) => {
        if (!isValidStationCoordinate(station.latitude, station.longitude)) return false
        if (networkView === 'all') return true
        return station.sourceCollectionId === networkView
      }),
    [stations, networkView]
  )

  const hasVisiblePendingNew = useMemo(
    () => mapStations.some((station) => pendingNewStationKeys.has(getStationMapKey(station))),
    [mapStations, pendingNewStationKeys]
  )

  const updateVisibleLegendNetworks = useCallback(
    (map: L.Map) => {
      if (networkView !== 'all') {
        setVisibleLegendNetworks([])
        return
      }

      const bounds = map.getBounds()
      const visible = new Set<NetworkCollectionId>()

      for (const station of mapStations) {
        if (!bounds.contains([station.latitude, station.longitude])) continue
        const collectionId = getStationLegendCollectionId(station, networkView)
        if (collectionId) visible.add(collectionId)
      }

      setVisibleLegendNetworks(NETWORK_COLLECTION_IDS.filter((id) => visible.has(id)))
    },
    [mapStations, networkView]
  )

  const fitMapToStations = useCallback((map: L.Map, nextStations: Station[]) => {
    if (nextStations.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }
    if (nextStations.length === 1) {
      const station = nextStations[0]
      map.setView([station.latitude, station.longitude], 12)
      return
    }
    const bounds = L.latLngBounds(
      nextStations.map((station) => [station.latitude, station.longitude] as L.LatLngTuple)
    )
    map.fitBounds(bounds, { padding: MAP_PADDING })
  }, [])

  const syncMarkers = useCallback(
    (map: L.Map) => {
      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current)
        markersLayerRef.current = null
      }
      markersByIdRef.current.clear()

      if (mapStations.length === 0) return

      const layerGroup = L.layerGroup()
      mapStations.forEach((station) => {
        const { hit } = getMarkerRadii(false, mobileMarkers)
        const latLng: L.LatLngTuple = [station.latitude, station.longitude]
        const isPendingNew = pendingNewStationKeys.has(getStationMapKey(station))
        const useSuperTramLogo = isSuperTramMapStop(station, networkView)

        const hitMarker = L.circleMarker(latLng, {
          radius: hit,
          fillColor: '#000000',
          fillOpacity: 0.001,
          stroke: false,
          weight: 0,
          className: 'stations-osm-map__hit-target',
        })

        const visualMarker = useSuperTramLogo
          ? L.marker(latLng, {
              icon: createSuperTramMapDivIcon(false, mobileMarkers, isPendingNew),
              interactive: false,
              keyboard: false,
            })
          : L.circleMarker(latLng, {
              radius: getMarkerRadii(false, mobileMarkers).visual,
              fillColor: getStationMarkerColor(station, networkView, pendingNewStationKeys),
              color: '#ffffff',
              weight: 2,
              fillOpacity: 0.95,
              interactive: false,
              className: 'stations-osm-map__visual-target',
            })

        hitMarker.on('click', (event) => {
          L.DomEvent.stopPropagation(event)
          onStationSelectRef.current(station)
        })

        layerGroup.addLayer(hitMarker)
        layerGroup.addLayer(visualMarker)
        markersByIdRef.current.set(getStationMapKey(station), {
          hit: hitMarker,
          visual: visualMarker,
          kind: useSuperTramLogo ? 'supertram-logo' : 'circle',
        })
      })
      layerGroup.addTo(map)
      markersLayerRef.current = layerGroup
    },
    [mapStations, networkView, mobileMarkers, pendingNewStationKeys]
  )

  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    const config = tileLayers[themeKey]
    const tiles = L.tileLayer(config.url, config.options)
    tiles.addTo(map)
    tileLayerRef.current = tiles
    mapRef.current = map

    map.on('click', (event) => {
      if (addStationModeRef.current && onAddStationAtLocationRef.current) {
        onAddStationAtLocationRef.current(event.latlng.lat, event.latlng.lng)
        return
      }
      onStationClearRef.current()
      setAddStationMenu(null)
    })

    map.on('contextmenu', (event) => {
      L.DomEvent.preventDefault(event.originalEvent)
      if (!allowAddStationRef.current || !onAddStationAtLocationRef.current) return

      setAddStationMenu({
        x: event.originalEvent.clientX,
        y: event.originalEvent.clientY,
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    })

    syncMarkers(map)
    fitMapToStations(map, publishedStations)

    const refreshSize = () => {
      map.invalidateSize({ pan: false })
    }
    const rafId = window.requestAnimationFrame(refreshSize)
    window.addEventListener('resize', refreshSize)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        window.requestAnimationFrame(refreshSize)
      })
      observer.observe(mapContainerRef.current)
    }

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', refreshSize)
      observer?.disconnect()
      if (markersLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(markersLayerRef.current)
      }
      markersLayerRef.current = null
      markersByIdRef.current.clear()
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount only

  useEffect(() => {
    if (!mapRef.current) return
    syncMarkers(mapRef.current)
  }, [syncMarkers])

  useEffect(() => {
    if (!mapRef.current) return
    fitMapToStations(mapRef.current, publishedStations)
  }, [fitMapToStations, publishedStations, networkView])

  useEffect(() => {
    markersByIdRef.current.forEach((marker, stationKey) => {
      const station = mapStations.find((item) => getStationMapKey(item) === stationKey)
      if (!station) return
      applyMarkerStyle(
        marker,
        station,
        networkView,
        pendingNewStationKeys,
        stationKey === selectedStationId,
        mobileMarkers
      )
    })
  }, [selectedStationId, mapStations, networkView, mobileMarkers, pendingNewStationKeys])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const refreshLegend = () => updateVisibleLegendNetworks(map)
    refreshLegend()
    map.on('moveend', refreshLegend)
    map.on('zoomend', refreshLegend)

    return () => {
      map.off('moveend', refreshLegend)
      map.off('zoomend', refreshLegend)
    }
  }, [updateVisibleLegendNetworks])

  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return
    const config = tileLayers[themeKey]
    mapRef.current.removeLayer(tileLayerRef.current)
    const newTiles = L.tileLayer(config.url, config.options)
    newTiles.addTo(mapRef.current)
    tileLayerRef.current = newTiles
  }, [themeKey, tileLayers])

  useEffect(() => {
    if (!addStationMode) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onAddStationModeChangeRef.current?.(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addStationMode])

  return (
    <div
      className={[
        'stations-osm-map',
        addStationMode ? 'stations-osm-map--add-station-mode' : '',
        allowAddStation ? 'stations-osm-map--admin-add' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div ref={mapContainerRef} className="stations-osm-map__canvas" aria-label="Map" />
      {addStationMode && (
        <p className="stations-osm-map__add-mode-hint" role="status">
          Click the map to add a station · Esc to exit
        </p>
      )}
      {allowAddStation && !addStationMode && (
        <MapAddStationContextMenu
          menu={addStationMenu}
          onClose={() => setAddStationMenu(null)}
          onAddStation={(latitude, longitude) => onAddStationAtLocation?.(latitude, longitude)}
        />
      )}
      {((networkView === 'all' && visibleLegendNetworks.length > 0) || hasVisiblePendingNew) && (
        <ul className="stations-osm-map__legend" aria-label="Map marker colours">
          {networkView === 'all' &&
            visibleLegendNetworks.map((collectionId) => (
              <li key={collectionId} className="stations-osm-map__legend-item">
                <span
                  className="stations-osm-map__legend-dot"
                  style={{ backgroundColor: NETWORK_MAP_COLORS[collectionId] }}
                  aria-hidden="true"
                />
                <span className="stations-osm-map__legend-label">{NETWORK_LABELS[collectionId]}</span>
              </li>
            ))}
          {hasVisiblePendingNew && (
            <li className="stations-osm-map__legend-item">
              <span
                className="stations-osm-map__legend-dot"
                style={{ backgroundColor: PENDING_NEW_STATION_MAP_COLOR }}
                aria-hidden="true"
              />
              <span className="stations-osm-map__legend-label">Unsaved new station</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default StationsOsmMap
