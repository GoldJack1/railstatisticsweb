import L from 'leaflet'
import { getMarkerVisualDiameter } from './mapMarkerSizing'
import { LIGHTRAIL_COLLECTION_ID } from './lightRailStationFields'
import { getStationNetworkCollectionId } from './stationAreaSlug'
import type { NetworkViewFilter } from '../constants/stationCollections'
import type { Station } from '../types'

export const SUPERTRAM_MAP_LOGO_URL = '/images/south-yorkshire-peoples-network-logo.svg'

const SUPERTRAM_LOGO_SVGMarkup = `<svg class="stations-osm-map__supertram-marker__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 99.87 47.54" aria-hidden="true"><path class="supertram-logo-fill" d="M12.76,45.2L3.51,22.86h30.81c.47,0,.91-.18,1.24-.51L53.2,4.71c1.52-1.52,3.55-2.36,5.71-2.36h28.2l9.26,22.34h-30.82c-.47,0-.9.18-1.23.51l-17.65,17.64c-1.5,1.5-3.58,2.36-5.71,2.36H12.76Z" fill="#ff5700"/><path class="supertram-logo-border" d="M85.54,4.69l7.31,17.65h-27.31c-1.09,0-2.12.43-2.89,1.2l-17.65,17.64c-1.07,1.07-2.53,1.68-4.05,1.68H14.33l-7.31-17.66h27.31c1.09,0,2.12-.43,2.89-1.2L54.86,6.36c1.07-1.07,2.53-1.68,4.05-1.68h26.63M58.91,4.69h0,0M88.67,0h-29.76c-2.78,0-5.4,1.08-7.36,3.05l-17.47,17.47H0l2.68,6.48,7.31,17.66,1.2,2.89h29.76c2.74,0,5.42-1.11,7.36-3.05l17.47-17.47h34.08l-2.68-6.48-7.31-17.65-1.2-2.89h0Z" fill="#ffffff"/></svg>`

/** Slightly larger than circle dots so the arrow logo stays legible. */
const SUPERTRAM_LOGO_SIZE_SCALE = 1.25

function getSuperTramMarkerSize(isSelected: boolean, mobile: boolean): number {
  return Math.round(getMarkerVisualDiameter(isSelected, mobile) * SUPERTRAM_LOGO_SIZE_SCALE)
}

export function isSuperTramMapStop(station: Station, networkView: NetworkViewFilter): boolean {
  const collectionId = getStationNetworkCollectionId(
    station,
    networkView !== 'all' ? networkView : undefined
  )
  if (collectionId === LIGHTRAIL_COLLECTION_ID) return true
  return station.sourceCollectionId === LIGHTRAIL_COLLECTION_ID
}

export function createSuperTramMapDivIcon(
  isSelected: boolean,
  mobile: boolean,
  isPendingNew: boolean
): L.DivIcon {
  const size = getSuperTramMarkerSize(isSelected, mobile)
  const classes = [
    'stations-osm-map__supertram-marker',
    mobile ? 'stations-osm-map__supertram-marker--mobile' : '',
    isSelected ? 'stations-osm-map__supertram-marker--selected' : '',
    isPendingNew ? 'stations-osm-map__supertram-marker--pending' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return L.divIcon({
    className: 'stations-osm-map__supertram-marker-shell',
    html: `<div class="${classes}" style="width:${size}px;height:${size}px" aria-hidden="true">${SUPERTRAM_LOGO_SVGMarkup}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}
