import L from 'leaflet'
import { createRailwayOverlayLayers } from './railwayOverlay'
import { getTileLayersConfig, type TileLayerConfig } from './mapTiles'

export type MapThemeKey = 'light' | 'dark'

export interface MapTileLayerRefs {
  base: L.TileLayer
  nationalOverlay: L.LayerGroup
  supertramOverlay: L.LayerGroup
}

function createBaseTileLayer(config: TileLayerConfig): L.TileLayer {
  return L.tileLayer(config.url, config.options)
}

export function createThemeTileLayers(themeKey: MapThemeKey): MapTileLayerRefs {
  const config = getTileLayersConfig()[themeKey]
  const base = createBaseTileLayer(config)
  const { national, supertram } = createRailwayOverlayLayers(themeKey)
  return { base, nationalOverlay: national, supertramOverlay: supertram }
}

export function addThemeTileLayersToMap(map: L.Map, themeKey: MapThemeKey): MapTileLayerRefs {
  const layers = createThemeTileLayers(themeKey)
  layers.base.addTo(map)
  layers.nationalOverlay.addTo(map)
  layers.supertramOverlay.addTo(map)
  return layers
}

export function swapThemeTileLayers(
  map: L.Map,
  current: MapTileLayerRefs,
  themeKey: MapThemeKey
): MapTileLayerRefs {
  map.removeLayer(current.base)
  map.removeLayer(current.nationalOverlay)
  map.removeLayer(current.supertramOverlay)
  return addThemeTileLayersToMap(map, themeKey)
}
