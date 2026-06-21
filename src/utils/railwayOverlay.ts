import L from 'leaflet'
import 'leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.js'

type RailwayOverlayTheme = 'light' | 'dark'

const CLOSED_RAILWAY_STATES = new Set(['disused', 'abandoned', 'razed'])

const HIDDEN_LINE: L.PathOptions = {
  weight: 0,
  opacity: 0,
  fillOpacity: 0,
  stroke: false
}

const OPEN_RAILWAY_MAP_ATTRIBUTION =
  'Style: <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'

/** SuperTram / People's Network logo orange */
const SUPERTRAM_ORANGE = '#ff5700'
/** Default tram/light_rail colour for networks outside SuperTram. */
const LIGHT_RAIL_COLOR = '#5ec269'
const SUBWAY_COLOR = '#5ec269'

const HEAVY_RAIL_COLORS: Record<RailwayOverlayTheme, string> = {
  dark: '#cccccc',
  light: '#000000'
}

/** South Yorkshire SuperTram + tram-train (ORM tiles lack network tags). */
const SUPERTRAM_MAP_BOUNDS = L.latLngBounds(
  [53.305, -1.68],
  [53.525, -1.28]
)

function isLightRailFeature(feature: string): boolean {
  return feature === 'light_rail' || feature === 'tram'
}

function isSupportedRailwayFeature(feature: string): boolean {
  return (
    feature === 'rail' ||
    feature === 'light_rail' ||
    feature === 'tram' ||
    feature === 'subway' ||
    feature === 'narrow_gauge' ||
    feature === 'funicular' ||
    feature === 'miniature'
  )
}

function lightRailLineWeight(zoom: number): number {
  return zoom >= 10 ? 2.5 : 2
}

function heavyRailLineWeight(zoom: number): number {
  return zoom >= 10 ? 3 : 2
}

function createStyleNationalRailwayLine(heavyRailColor: string) {
  return function styleNationalRailwayLine(
    properties: Record<string, unknown>,
    zoom: number
  ): L.PathOptions {
    const state = String(properties.state ?? '')
    if (CLOSED_RAILWAY_STATES.has(state)) {
      return HIDDEN_LINE
    }

    const feature = String(properties.feature ?? '')
    if (!isSupportedRailwayFeature(feature)) {
      return HIDDEN_LINE
    }

    const isLightRail = isLightRailFeature(feature)
    const isSubway = feature === 'subway'
    const color = isLightRail ? LIGHT_RAIL_COLOR : isSubway ? SUBWAY_COLOR : heavyRailColor
    const weight = isLightRail || isSubway ? lightRailLineWeight(zoom) : heavyRailLineWeight(zoom)

    return {
      color,
      weight,
      opacity: 1,
      fill: false,
      lineCap: 'round',
      lineJoin: 'round'
    }
  }
}

/** Orange tram/light_rail only — drawn over the national layer inside SuperTram bounds. */
function styleSuperTramRailwayLine(properties: Record<string, unknown>, zoom: number): L.PathOptions {
  const state = String(properties.state ?? '')
  if (CLOSED_RAILWAY_STATES.has(state)) {
    return HIDDEN_LINE
  }

  const feature = String(properties.feature ?? '')
  if (!isLightRailFeature(feature)) {
    return HIDDEN_LINE
  }

  return {
    color: SUPERTRAM_ORANGE,
    weight: lightRailLineWeight(zoom),
    opacity: 1,
    fill: false,
    lineCap: 'round',
    lineJoin: 'round'
  }
}

type VectorRailwayLayerOptions = {
  url: string
  layerName: string
  zoomBounds?: { minZoom?: number; maxZoom?: number; minNativeZoom?: number; maxNativeZoom?: number }
  bounds?: L.LatLngBounds
  style: (properties: Record<string, unknown>, zoom: number) => L.PathOptions
}

function createVectorRailwayLayer({
  url,
  layerName,
  zoomBounds,
  bounds,
  style
}: VectorRailwayLayerOptions): L.GridLayer {
  return L.vectorGrid.protobuf(url, {
    attribution: OPEN_RAILWAY_MAP_ATTRIBUTION,
    pane: 'overlayPane',
    bounds,
    vectorTileLayerStyles: {
      [layerName]: style
    },
    ...zoomBounds
  })
}

/** Railway line overlay (active infrastructure only). */
export function createRailwayOverlayLayer(themeKey: RailwayOverlayTheme): L.LayerGroup {
  const styleNationalRailwayLine = createStyleNationalRailwayLine(HEAVY_RAIL_COLORS[themeKey])

  const lowZoomLines = createVectorRailwayLayer({
    url: 'https://openrailwaymap.app/standard_railway_line_low/{z}/{x}/{y}',
    layerName: 'standard_railway_line_low',
    zoomBounds: { maxNativeZoom: 7, maxZoom: 7 },
    style: styleNationalRailwayLine
  })

  const highZoomLines = createVectorRailwayLayer({
    url: 'https://openrailwaymap.app/railway_line_high/{z}/{x}/{y}',
    layerName: 'railway_line_high',
    zoomBounds: { minNativeZoom: 8, minZoom: 8 },
    style: styleNationalRailwayLine
  })

  const lowZoomSuperTram = createVectorRailwayLayer({
    url: 'https://openrailwaymap.app/standard_railway_line_low/{z}/{x}/{y}',
    layerName: 'standard_railway_line_low',
    zoomBounds: { maxNativeZoom: 7, maxZoom: 7 },
    bounds: SUPERTRAM_MAP_BOUNDS,
    style: styleSuperTramRailwayLine
  })

  const highZoomSuperTram = createVectorRailwayLayer({
    url: 'https://openrailwaymap.app/railway_line_high/{z}/{x}/{y}',
    layerName: 'railway_line_high',
    zoomBounds: { minNativeZoom: 8, minZoom: 8 },
    bounds: SUPERTRAM_MAP_BOUNDS,
    style: styleSuperTramRailwayLine
  })

  return L.layerGroup([lowZoomLines, highZoomLines, lowZoomSuperTram, highZoomSuperTram])
}
