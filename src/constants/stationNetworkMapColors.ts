import type { NetworkCollectionId } from './stationCollections'

export const NETWORK_MAP_COLORS: Record<NetworkCollectionId, string> = {
  stations_gbnr: '#312783',
  stations_nitranslink: '#03846E',
  stations_roiirerail: '#32A441',
  stations_gbheritage: '#dc2626',
}

export const NETWORK_MAP_FALLBACK_COLOR = '#64748b'

/** Unsaved new stations staged via pending changes (not yet published). */
export const PENDING_NEW_STATION_MAP_COLOR = '#111111'

/** Border colour for the currently selected map pin. */
export const SELECTED_MARKER_BORDER_COLOR = '#2563eb'
