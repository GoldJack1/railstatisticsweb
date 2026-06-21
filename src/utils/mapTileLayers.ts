import L from 'leaflet'
import { createRailwayOverlayLayer } from './railwayOverlay'
import { getTileLayersConfig, type TileLayerConfig } from './mapTiles'

export type MapThemeKey = 'light' | 'dark'

export interface MapTileLayerRefs {
  base: L.TileLayer
  overlay: L.Layer | null
}

function createBaseTileLayer(config: TileLayerConfig): L.TileLayer {
  return L.tileLayer(config.url, config.options)
}

export function createThemeTileLayers(themeKey: MapThemeKey): MapTileLayerRefs {
  const config = getTileLayersConfig()[themeKey]
  const base = createBaseTileLayer(config)
  const overlay = createRailwayOverlayLayer(themeKey)
  return { base, overlay }
}

export function addThemeTileLayersToMap(map: L.Map, themeKey: MapThemeKey): MapTileLayerRefs {
  const layers = createThemeTileLayers(themeKey)
  layers.base.addTo(map)
  layers.overlay?.addTo(map)
  return layers
}

export function swapThemeTileLayers(
  map: L.Map,
  current: MapTileLayerRefs,
  themeKey: MapThemeKey
): MapTileLayerRefs {
  map.removeLayer(current.base)
  if (current.overlay) {
    map.removeLayer(current.overlay)
  }
  return addThemeTileLayersToMap(map, themeKey)
}
