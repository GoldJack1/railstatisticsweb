export const NETWORK_COLLECTION_IDS = [
  'stations_gbnr',
  'stations_nitranslink',
  'stations_roiirerail',
] as const

export type NetworkCollectionId = (typeof NETWORK_COLLECTION_IDS)[number]

export type NetworkViewFilter = 'all' | NetworkCollectionId

export const NETWORK_LABELS: Record<NetworkCollectionId, string> = {
  stations_gbnr: 'GB National Rail',
  stations_nitranslink: 'NI Translink',
  stations_roiirerail: 'Irish Rail',
}

export const NETWORK_VIEW_TABS: Array<{ label: string; value: NetworkViewFilter }> = [
  { label: 'All', value: 'all' },
  { label: NETWORK_LABELS.stations_gbnr, value: 'stations_gbnr' },
  { label: NETWORK_LABELS.stations_nitranslink, value: 'stations_nitranslink' },
  { label: NETWORK_LABELS.stations_roiirerail, value: 'stations_roiirerail' },
]

export const SANDBOX_COLLECTION_ID = 'newsandboxstations1' as const

export type StationCollectionId = NetworkCollectionId | typeof SANDBOX_COLLECTION_ID

export const STATION_COLLECTION_DISPLAY_LABELS: Record<StationCollectionId, string> = {
  stations_gbnr: 'GB National Rail (stations_gbnr)',
  stations_nitranslink: 'NI Translink (stations_nitranslink)',
  stations_roiirerail: 'Irish Rail (stations_roiirerail)',
  newsandboxstations1: 'Sandbox (newsandboxstations1)',
}

export const DEFAULT_NETWORK_COLLECTION_ID: NetworkCollectionId = 'stations_gbnr'

export const DEFAULT_NETWORK_VIEW: NetworkViewFilter = 'all'

export const STATION_NETWORK_STORAGE_KEY = 'railstats_station_network'
export const STATION_NETWORK_VIEW_STORAGE_KEY = 'railstats_station_network_view'
export const STATION_SANDBOX_STORAGE_KEY = 'railstats_station_sandbox'
/** Legacy key — migrated to network + sandbox keys */
export const STATION_COLLECTION_STORAGE_KEY = 'railstats_station_collection'

export function isNetworkCollection(id: string): id is NetworkCollectionId {
  return (NETWORK_COLLECTION_IDS as readonly string[]).includes(id)
}

export function isSandboxCollection(id: string): id is typeof SANDBOX_COLLECTION_ID {
  return id === SANDBOX_COLLECTION_ID
}

export function isStationCollectionId(id: string): id is StationCollectionId {
  return isNetworkCollection(id) || isSandboxCollection(id)
}

export function isNetworkViewFilter(value: string): value is NetworkViewFilter {
  return value === 'all' || isNetworkCollection(value)
}

export function deriveCollectionId(
  networkView: NetworkViewFilter,
  networkId: NetworkCollectionId,
  isSandbox: boolean
): StationCollectionId {
  if (isSandbox) return SANDBOX_COLLECTION_ID
  if (networkView !== 'all') return networkView
  return networkId
}

export function getStationCollectionDisplayLabel(id: StationCollectionId): string {
  return STATION_COLLECTION_DISPLAY_LABELS[id]
}

export function getNetworkCollectionDisplayLabel(id: NetworkCollectionId): string {
  return NETWORK_LABELS[id]
}
