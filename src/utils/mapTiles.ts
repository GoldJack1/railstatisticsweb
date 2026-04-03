/**
 * Map tile layer config. Same OpenStreetMap layer for light and dark theme.
 */

import { useOsmBackendProxy } from './osmBackendProxy'

export interface TileLayerConfig {
  url: string
  options: { attribution: string }
}

const OSM_DIRECT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_PROXY = '/api/osm-tile?s={s}&z={z}&x={x}&y={y}'

const OSM_CONFIG: TileLayerConfig = {
  url: useOsmBackendProxy() ? OSM_PROXY : OSM_DIRECT,
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
}

export function getTileLayersConfig(): { light: TileLayerConfig; dark: TileLayerConfig } {
  return { light: OSM_CONFIG, dark: OSM_CONFIG }
}
