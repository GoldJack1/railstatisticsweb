import L from 'leaflet'
import {
  getMarkerStrokeWeight,
  getMarkerVisualDiameter,
  getSuperTramIconOuterDiameter,
  MARKER_STROKE,
} from './mapMarkerSizing'
import { LIGHTRAIL_COLLECTION_ID } from './lightRailStationFields'
import { getStationNetworkCollectionId } from './stationAreaSlug'
import type { NetworkViewFilter } from '../constants/stationCollections'
import type { Station } from '../types'

export const SUPERTRAM_MAP_LOGO_URL = '/images/south-yorkshire-peoples-network-logo.svg'

/** Black blob + orange arrow; outline is drawn via CSS to match circle markers. */
const SUPERTRAM_LOGO_SVGMarkup = `<svg class="stations-osm-map__supertram-marker__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 134.1 134.1" aria-hidden="true"><path class="supertram-logo-bg" d="M67.05,130.6c-35.04,0-63.55-28.51-63.55-63.55S32.01,3.5,67.05,3.5s63.55,28.51,63.55,63.55-28.51,63.55-63.55,63.55Z"/><path class="supertram-logo-fill" d="M77.06,45.76c-1.69,0-3.32.67-4.52,1.87l-19.68,19.68c-.85.85-2.01,1.34-3.22,1.34h-30.46l8.16,19.69h29.71c1.69,0,3.32-.67,4.52-1.87l19.69-19.68c.85-.85,2.01-1.34,3.22-1.34h30.47l-8.16-19.69h-29.71,0Z" fill="#ff5700"/></svg>`

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
  const innerSize = getMarkerVisualDiameter(isSelected, mobile)
  const iconSize = getSuperTramIconOuterDiameter(isSelected, mobile)
  const strokeWeight = getMarkerStrokeWeight(isSelected)
  const strokeColor = isSelected ? MARKER_STROKE.color.selected : MARKER_STROKE.color.normal
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
    html: `<div class="${classes}" style="width:${innerSize}px;height:${innerSize}px;border-width:${strokeWeight}px;border-color:${strokeColor}" aria-hidden="true">${SUPERTRAM_LOGO_SVGMarkup}</div>`,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
  })
}
