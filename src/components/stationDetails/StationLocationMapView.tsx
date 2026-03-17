import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../hooks/useTheme'

// Precise circle marker: center is exactly the station coordinates (no anchor ambiguity)
const PRECISE_MARKER_OPTIONS: L.CircleMarkerOptions = {
  radius: 10,
  fillColor: '#2563eb',
  color: '#fff',
  weight: 2,
  fillOpacity: 0.95
}

// Light: standard OSM. Dark: Stadia Alidade Smooth Dark for better contrast and detail (roads, labels)
const TILE_LAYERS = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  },
  dark: {
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    options: {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  }
} as const

interface StationLocationMapViewProps {
  latitude: number
  longitude: number
  /** Height in pixels */
  height?: number
}

const DEFAULT_ZOOM = 15

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export function StationLocationMapView({
  latitude,
  longitude,
  height = 500
}: StationLocationMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const { theme } = useTheme()
  const themeKey = theme === 'dark' ? 'dark' : 'light'
  const center: L.LatLngTuple = [latitude, longitude]

  // Init map and precise circle marker once
  useEffect(() => {
    if (!mapRef.current || !isValidCoord(latitude, longitude)) return
    const config = TILE_LAYERS[themeKey]
    const map = L.map(mapRef.current).setView(center, DEFAULT_ZOOM)
    const tiles = L.tileLayer(config.url, config.options)
    tiles.addTo(map)
    tileLayerRef.current = tiles
    const marker = L.circleMarker(center, PRECISE_MARKER_OPTIONS)
    marker.addTo(map)
    markerRef.current = marker
    mapInstanceRef.current = map
    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      tileLayerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount only

  // When theme changes, swap tile layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return
    const config = TILE_LAYERS[themeKey]
    mapInstanceRef.current.removeLayer(tileLayerRef.current)
    const newTiles = L.tileLayer(config.url, config.options)
    newTiles.addTo(mapInstanceRef.current)
    tileLayerRef.current = newTiles
  }, [themeKey])

  // When lat/lng change (e.g. from props), update map view and marker
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !isValidCoord(latitude, longitude)) return
    const latlng: L.LatLngExpression = [latitude, longitude]
    markerRef.current.setLatLng(latlng)
    mapInstanceRef.current.setView(latlng, mapInstanceRef.current.getZoom())
  }, [latitude, longitude])

  if (!isValidCoord(latitude, longitude)) return null

  return (
    <div
      ref={mapRef}
      className="location-map-preview location-map-preview-osm"
      style={{ height: `${height}px` }}
      aria-label="Station location map"
    />
  )
}

export default StationLocationMapView
