import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { NetworkViewFilter } from '../constants/stationCollections'
import { isNetworkCollection } from '../constants/stationCollections'
import type { Station } from '../types'
import { getStationMapKey } from './stationAreaSlug'
import { isValidStationCoordinate } from './stationCoordinates'

export function pendingEntryToMapStation(stationId: string, entry: PendingChangeEntry): Station | null {
  if (!entry.isNew) return null

  const latitude =
    typeof entry.updated.latitude === 'number' ? entry.updated.latitude : entry.original.latitude
  const longitude =
    typeof entry.updated.longitude === 'number' ? entry.updated.longitude : entry.original.longitude

  if (!isValidStationCoordinate(latitude, longitude)) return null

  const sourceCollectionId = isNetworkCollection(entry.targetCollectionId)
    ? entry.targetCollectionId
    : undefined

  return {
    ...entry.original,
    ...entry.updated,
    id: stationId,
    stationName: entry.updated.stationName ?? entry.original.stationName,
    crsCode: entry.updated.crsCode ?? entry.original.crsCode,
    tiploc: entry.updated.tiploc ?? entry.original.tiploc,
    latitude,
    longitude,
    country: entry.updated.country ?? entry.original.country,
    county: entry.updated.county ?? entry.original.county,
    toc: entry.updated.toc ?? entry.original.toc,
    stnarea: entry.updated.stnarea ?? entry.original.stnarea,
    borough: entry.updated.borough ?? entry.original.borough,
    fareZone: entry.updated.fareZone ?? entry.original.fareZone,
    yearlyPassengers: (entry.updated.yearlyPassengers ??
      entry.original.yearlyPassengers) as Station['yearlyPassengers'],
    sourceCollectionId,
  }
}

export function mergePendingNewStationsForMap(
  firestoreStations: Station[],
  pendingChanges: Record<string, PendingChangeEntry>,
  networkView: NetworkViewFilter
): { stations: Station[]; pendingNewKeys: Set<string> } {
  const existingKeys = new Set(firestoreStations.map(getStationMapKey))
  const pendingNewKeys = new Set<string>()
  const pendingStations: Station[] = []

  for (const [id, entry] of Object.entries(pendingChanges)) {
    const station = pendingEntryToMapStation(id, entry)
    if (!station) continue

    const key = getStationMapKey(station)
    if (existingKeys.has(key)) continue
    if (networkView !== 'all' && station.sourceCollectionId !== networkView) continue

    pendingNewKeys.add(key)
    pendingStations.push(station)
  }

  return { stations: [...firestoreStations, ...pendingStations], pendingNewKeys }
}
