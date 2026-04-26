import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../../hooks/useTheme'
import { getTileLayersConfig } from '../../../utils/mapTiles'

// Precise circle marker: center is exactly the station coordinates (no anchor ambiguity)
const PRECISE_MARKER_OPTIONS: L.CircleMarkerOptions = {
  radius: 10,
  fillColor: '#2563eb',
  color: '#fff',
  weight: 2,
  fillOpacity: 0.95
}

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
  height
}: StationLocationMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const tileProbeLoggedRef = useRef(false)
  const instanceIdRef = useRef(`map_${Math.random().toString(36).slice(2, 9)}`)
  const { theme } = useTheme()
  const themeKey = theme === 'dark' ? 'dark' : 'light'
  const center: L.LatLngTuple = [latitude, longitude]
  const tileLayers = getTileLayersConfig()

  // Init map and precise circle marker once
  useEffect(() => {
    if (!mapRef.current || !isValidCoord(latitude, longitude)) {
      // #region agent log
      fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H1',location:'StationLocationMapView.tsx:init-guard',message:'Map init skipped due missing ref or invalid coords',data:{hasRef:Boolean(mapRef.current),latitude,longitude,validCoord:isValidCoord(latitude, longitude)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      return
    }
    const containerRect = mapRef.current.getBoundingClientRect()
    const inMeasureLayer = Boolean(mapRef.current.closest('.station-details-measure-layer'))
    const inVisibleBody = Boolean(mapRef.current.closest('.station-details-visible-body'))
    // #region agent log
    fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H7',location:'StationLocationMapView.tsx:init-before-map',message:'Before Leaflet map creation',data:{instanceId:instanceIdRef.current,inMeasureLayer,inVisibleBody,clientWidth:mapRef.current.clientWidth,clientHeight:mapRef.current.clientHeight,rectWidth:containerRect.width,rectHeight:containerRect.height,offsetWidth:mapRef.current.offsetWidth,offsetHeight:mapRef.current.offsetHeight,heightProp:height ?? null},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    const config = tileLayers[themeKey]
    const map = L.map(mapRef.current).setView(center, DEFAULT_ZOOM)
    const tiles = L.tileLayer(config.url, config.options)
    tiles.addTo(map)
    tiles.on('load', () => {
      if (!mapRef.current || tileProbeLoggedRef.current) return
      tileProbeLoggedRef.current = true
      const tile = mapRef.current.querySelector('.leaflet-tile') as HTMLImageElement | null
      const tilePane = mapRef.current.querySelector('.leaflet-tile-pane') as HTMLElement | null
      const mapPane = mapRef.current.querySelector('.leaflet-map-pane') as HTMLElement | null
      const containerStyles = window.getComputedStyle(mapRef.current)
      const tileStyles = tile ? window.getComputedStyle(tile) : null
      // #region agent log
      fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H6',location:'StationLocationMapView.tsx:tile-layer-load',message:'Leaflet tile layer loaded and measured',data:{instanceId:instanceIdRef.current,tileNaturalWidth:tile?.naturalWidth ?? null,tileNaturalHeight:tile?.naturalHeight ?? null,tileClientWidth:tile?.clientWidth ?? null,tileClientHeight:tile?.clientHeight ?? null,tileStyleWidth:tile?.style.width ?? null,tileStyleHeight:tile?.style.height ?? null,tileComputedMaxWidth:tileStyles?.maxWidth ?? null,tileComputedWidth:tileStyles?.width ?? null,tileComputedTransform:tileStyles?.transform ?? null,tilePaneTransform:tilePane?.style.transform ?? null,mapPaneTransform:mapPane?.style.transform ?? null,containerComputedWidth:containerStyles.width,containerComputedMaxWidth:containerStyles.maxWidth,containerComputedOverflow:containerStyles.overflow},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    })
    tileLayerRef.current = tiles
    const marker = L.circleMarker(center, PRECISE_MARKER_OPTIONS)
    marker.addTo(map)
    markerRef.current = marker
    mapInstanceRef.current = map
    // #region agent log
    fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H2',location:'StationLocationMapView.tsx:init-after-map',message:'After Leaflet map creation',data:{mapSize:map.getSize(),zoom:map.getZoom(),center:map.getCenter(),leafletContainersInDom:document.querySelectorAll('.location-map-preview-osm').length},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H4',location:'StationLocationMapView.tsx:init-cleanup',message:'Leaflet map cleanup',data:{hadMap:Boolean(mapInstanceRef.current),hadMarker:Boolean(markerRef.current),hadTileLayer:Boolean(tileLayerRef.current)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      tileLayerRef.current = null
      tileProbeLoggedRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount only

  // Ensure Leaflet recalculates and repaints after responsive layout changes.
  useEffect(() => {
    if (!mapRef.current || !mapInstanceRef.current) return

    const map = mapInstanceRef.current
    const container = mapRef.current

    const refreshSize = () => {
      if (!mapInstanceRef.current) return
      const beforeSize = map.getSize()
      const rect = container.getBoundingClientRect()
      const mapWrap = container.closest('.station-details-location-map-wrap') as HTMLElement | null
      const modalSection = container.closest('.modal-section--location') as HTMLElement | null
      const modalBody = container.closest('.modal-body') as HTMLElement | null
      map.invalidateSize({ pan: false, debounceMoveend: true })
      map.setView([latitude, longitude], map.getZoom(), { animate: false })
      const afterSize = map.getSize()
      const tile = container.querySelector('.leaflet-tile') as HTMLImageElement | null
      const tileStyles = tile ? window.getComputedStyle(tile) : null
      const wrapRect = mapWrap?.getBoundingClientRect()
      const sectionRect = modalSection?.getBoundingClientRect()
      const bodyRect = modalBody?.getBoundingClientRect()
      // #region agent log
      fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H9',location:'StationLocationMapView.tsx:refreshSize',message:'refreshSize invalidate executed',data:{instanceId:instanceIdRef.current,beforeSize,afterSize,rectWidth:rect.width,rectHeight:rect.height,clientWidth:container.clientWidth,clientHeight:container.clientHeight,wrapWidth:wrapRect?.width ?? null,sectionWidth:sectionRect?.width ?? null,modalBodyWidth:bodyRect?.width ?? null,viewportWidth:window.innerWidth,tileClientWidth:tile?.clientWidth ?? null,tileComputedMaxWidth:tileStyles?.maxWidth ?? null,tileComputedWidth:tileStyles?.width ?? null},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }

    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(refreshSize)
    })
    const timeoutIds = [80, 200, 500].map((delay) => window.setTimeout(refreshSize, delay))

    window.addEventListener('resize', refreshSize)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        // #region agent log
        fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H3',location:'StationLocationMapView.tsx:resize-observer',message:'ResizeObserver callback fired',data:{clientWidth:container.clientWidth,clientHeight:container.clientHeight},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        window.requestAnimationFrame(refreshSize)
      })
      observer.observe(container)
      if (container.parentElement) {
        observer.observe(container.parentElement)
      }
    }

    return () => {
      window.cancelAnimationFrame(rafId)
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
      window.removeEventListener('resize', refreshSize)
      observer?.disconnect()
    }
  }, [latitude, longitude, height])

  // When theme changes, swap tile layer (same OSM for both; effect keeps layer in sync)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return
    const config = tileLayers[themeKey]
    mapInstanceRef.current.removeLayer(tileLayerRef.current)
    const newTiles = L.tileLayer(config.url, config.options)
    newTiles.addTo(mapInstanceRef.current)
    tileLayerRef.current = newTiles
  }, [themeKey, tileLayers])

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
      style={height ? { height: `${height}px` } : undefined}
      aria-label="Station location map"
    />
  )
}

export default StationLocationMapView
