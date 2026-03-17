/**
 * Map tile layer config. Same OpenStreetMap layer for light and dark theme.
 */

export interface TileLayerConfig {
  url: string
  options: { attribution: string }
}

const OSM_CONFIG: TileLayerConfig = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
}

export function getTileLayersConfig(): { light: TileLayerConfig; dark: TileLayerConfig } {
  return { light: OSM_CONFIG, dark: OSM_CONFIG }
}
