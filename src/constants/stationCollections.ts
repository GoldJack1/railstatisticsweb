export const NETWORK_COLLECTION_IDS = [
  'stations_gbnr',
  'stations_nitranslink',
  'stations_roiirerail',
  'stations_gbheritage',
  'lightrail_GBSHEFFSUPERTRAM',
] as const

/** Production networks that trigger new-station push notifications (excludes heritage + sandbox). */
export const NEW_STATION_NOTIFICATION_COLLECTION_IDS = [
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
  stations_gbheritage: 'GB Heritage',
  lightrail_GBSHEFFSUPERTRAM: 'South Yorkshire SuperTram',
}

export const NETWORK_VIEW_TABS: Array<{ label: string; value: NetworkViewFilter }> = [
  { label: 'All', value: 'all' },
  { label: NETWORK_LABELS.stations_gbnr, value: 'stations_gbnr' },
  { label: NETWORK_LABELS.stations_nitranslink, value: 'stations_nitranslink' },
  { label: NETWORK_LABELS.stations_roiirerail, value: 'stations_roiirerail' },
  { label: NETWORK_LABELS.stations_gbheritage, value: 'stations_gbheritage' },
  { label: NETWORK_LABELS.lightrail_GBSHEFFSUPERTRAM, value: 'lightrail_GBSHEFFSUPERTRAM' },
]

export const SANDBOX_COLLECTION_ID = 'newsandboxstations1' as const

export type StationCollectionId = NetworkCollectionId | typeof SANDBOX_COLLECTION_ID

export const STATION_COLLECTION_DISPLAY_LABELS: Record<StationCollectionId, string> = {
  stations_gbnr: 'GB National Rail (stations_gbnr)',
  stations_nitranslink: 'NI Translink (stations_nitranslink)',
  stations_roiirerail: 'Irish Rail (stations_roiirerail)',
  stations_gbheritage: 'GB Heritage (stations_gbheritage)',
  lightrail_GBSHEFFSUPERTRAM: 'South Yorkshire SuperTram (lightrail_GBSHEFFSUPERTRAM)',
  newsandboxstations1: 'Sandbox (newsandboxstations1)',
}

export const DEFAULT_NETWORK_COLLECTION_ID: NetworkCollectionId = 'stations_gbnr'

/** Default `stnarea` value when adding a station to each network collection. */
export const NETWORK_STNAREA_DEFAULTS: Record<NetworkCollectionId, string> = {
  stations_gbnr: 'GBNR',
  stations_nitranslink: 'NITRANSLINK',
  stations_roiirerail: 'ROIIRERAIL',
  stations_gbheritage: 'GBHERITAGE',
  lightrail_GBSHEFFSUPERTRAM: 'GBSHEFFSUPERTRAM',
}

/** URL path segment for each network in station detail routes (e.g. `/stations/gb-heritage/keighley`). */
export const NETWORK_URL_SLUGS: Record<NetworkCollectionId, string> = {
  stations_gbnr: 'gb-national-rail',
  stations_nitranslink: 'ni-translink',
  stations_roiirerail: 'irish-rail',
  stations_gbheritage: 'gb-heritage',
  lightrail_GBSHEFFSUPERTRAM: 'south-yorkshire-supertram',
}

export const SANDBOX_URL_SLUG = 'sandbox' as const

/** Reverse lookup from `stnarea` code to network collection. */
export const STNAREA_TO_NETWORK_COLLECTION: Record<string, NetworkCollectionId> = {
  GBNR: 'stations_gbnr',
  NITRANSLINK: 'stations_nitranslink',
  ROIIRERAIL: 'stations_roiirerail',
  GBHERITAGE: 'stations_gbheritage',
  GBSHEFFSUPERTRAM: 'lightrail_GBSHEFFSUPERTRAM',
}

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
