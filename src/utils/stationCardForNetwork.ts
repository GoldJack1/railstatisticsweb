import type { Station } from '../types'
import { LIGHTRAIL_COLLECTION_ID } from './lightRailStationFields'

export function isLightRailStop(station: Pick<Station, 'sourceCollectionId' | 'stnarea'>): boolean {
  if (station.sourceCollectionId === LIGHTRAIL_COLLECTION_ID) return true
  return station.stnarea?.trim().toUpperCase() === 'GBSHEFFSUPERTRAM'
}
