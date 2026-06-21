import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../../../components/maps/leafletDarkTiles.css'
import { useTheme } from '../../../hooks/useTheme'
import { addThemeTileLayersToMap, swapThemeTileLayers, type MapTileLayerRefs } from '../../../utils/mapTileLayers'
import { useOsmBackendProxy } from '../../../utils/osmBackendProxy'
import TXTINPIconWideButtonSearch from '../../textInputs/special/TXTINPIconWideButtonSearch'

// Same as view: precise circle marker (draggable in edit mode)
const CIRCLE_ICON = L.divIcon({
  className: 'location-map-picker-circle-marker',
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

const NOMINATIM_DIRECT = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_PROXY = '/api/nominatim-search'
const USER_AGENT = 'RailStatisticsWebsite/1.0 (station location picker)'

function nominatimSearchUrl(): string {
  return useOsmBackendProxy() ? NOMINATIM_PROXY : NOMINATIM_DIRECT
}

export interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type: string
  class: string
}

interface LocationMapPickerProps {
  latitude: number
  longitude: number
  onLatLngChange: (lat: number, lng: number) => void
  /** Optional: height of the map in pixels */
  height?: number
}

const DEFAULT_CENTER: L.LatLngTuple = [51.5074, -0.1278]
const DEFAULT_ZOOM = 13

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0) // treat 0,0 as "not set"
  )
}

export function LocationMapPicker({
  latitude,
  longitude,
  onLatLngChange,
  height = 480
}: LocationMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const tileLayersRef = useRef<MapTileLayerRefs | null>(null)
  const { theme } = useTheme()
  const themeKey = theme === 'dark' ? 'dark' : 'light'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const SearchIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="7" cy="7" r="4" />
      <line x1="11" y1="11" x2="13" y2="13" />
    </svg>
  )

  const hasValidCoords = isValidCoord(latitude, longitude)
  const center: L.LatLngTuple = hasValidCoords ? [latitude, longitude] : DEFAULT_CENTER

  const updateMarker = useCallback(
    (lat: number, lng: number) => {
      if (!mapInstanceRef.current) return
      const latlng: L.LatLngExpression = [lat, lng]
      if (markerRef.current) {
        markerRef.current.setLatLng(latlng)
      } else {
        const marker = L.marker(latlng, { draggable: true, icon: CIRCLE_ICON })
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onLatLngChange(pos.lat, pos.lng)
        })
        marker.addTo(mapInstanceRef.current)
        markerRef.current = marker
      }
      mapInstanceRef.current.setView(latlng, mapInstanceRef.current.getZoom())
    },
    [onLatLngChange]
  )

  // Initialize map once (theme-based tiles + optional circle marker)
  useEffect(() => {
    if (!mapRef.current) return
    const map = L.map(mapRef.current).setView(center, DEFAULT_ZOOM)
    tileLayersRef.current = addThemeTileLayersToMap(map, themeKey)
    mapInstanceRef.current = map
    if (hasValidCoords) {
      const marker = L.marker([latitude, longitude], { draggable: true, icon: CIRCLE_ICON })
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onLatLngChange(pos.lat, pos.lng)
      })
      marker.addTo(map)
      markerRef.current = marker
    }
    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      tileLayersRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- init map once

  // When theme changes, swap tile layer (match view map)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayersRef.current) return
    tileLayersRef.current = swapThemeTileLayers(
      mapInstanceRef.current,
      tileLayersRef.current,
      themeKey
    )
  }, [themeKey])

  // Sync marker when lat/lng change from parent (e.g. manual input)
  useEffect(() => {
    if (!mapInstanceRef.current || !isValidCoord(latitude, longitude)) return
    updateMarker(latitude, longitude)
  }, [latitude, longitude, updateMarker])

  // Search: debounced fetch
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({
          q: searchQuery.trim(),
          format: 'json',
          limit: '8'
        })
        const base = nominatimSearchUrl()
        const res = await fetch(`${base}?${params}`, {
          headers: useOsmBackendProxy() ? {} : { 'User-Agent': USER_AGENT }
        })
        const data: NominatimResult[] = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
        setShowResults(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  const handleSelectPlace = (result: NominatimResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    if (!isValidCoord(lat, lng)) return
    onLatLngChange(lat, lng)
    setSearchQuery(result.display_name)
    setShowResults(false)
    setSearchResults([])
    updateMarker(lat, lng)
  }

  return (
    <div className="location-map-picker">
      <div className="location-map-picker-search">
        <label className="edit-label" htmlFor="location-search-place">
          Search for a place
        </label>
        <TXTINPIconWideButtonSearch
          inputId="location-search-place"
          name="location-place-search"
          icon={SearchIcon}
          colorVariant="secondary"
          className="location-map-picker-input-shell"
          inputClassName="location-map-picker-input"
          placeholder="e.g. London King's Cross"
          value={searchQuery}
          onChange={setSearchQuery}
          onFocus={() => searchQuery.trim() && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          autoComplete="off"
        />
        {searching && <span className="location-map-picker-loading">Searching…</span>}
        {showResults && searchResults.length > 0 && (
          <ul className="location-map-picker-results" role="listbox">
            {searchResults.map((r) => (
              <li
                key={r.place_id}
                role="option"
                className="location-map-picker-result"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelectPlace(r)
                }}
              >
                {r.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="edit-hint location-map-picker-hint">
        Move the pin on the map to set the station coordinates. The latitude and longitude fields below update automatically.
      </p>
      <div
        ref={mapRef}
        className="location-map-picker-map"
        style={{ height: `${height}px` }}
        aria-label="Map to set station location"
      />
    </div>
  )
}

export default LocationMapPicker
