import type { NetworkCollectionId } from '../constants/stationCollections'

export type NewStationNavigationState = {
  latitude?: number
  longitude?: number
  targetCollectionId?: NetworkCollectionId
  returnTo?: string
  /** Edit an unpublished new-station draft already in pending changes. */
  editPendingStationId?: string
}
