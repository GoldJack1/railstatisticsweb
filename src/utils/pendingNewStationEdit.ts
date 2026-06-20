import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { StationCollectionId } from '../constants/stationCollections'
import { isNetworkCollection } from '../constants/stationCollections'
import type { SandboxStationDoc, Station, YearlyPassengers } from '../types'
import type { NewStationNavigationState } from '../types/newStationNavigation'

export type PendingNewStationDraftPrefill = {
  stationId: string
  targetCollectionId: StationCollectionId
  form: Partial<Station>
  additionalForm: Partial<SandboxStationDoc>
  yearlyPassengersRows: Array<{ year: string; value: string }>
  facilitiesRows: Array<{ key: string; value: string }>
}

function buildYearlyPassengerRows(yearlyPassengers: Station['yearlyPassengers'] | undefined): Array<{ year: string; value: string }> {
  const currentYear = new Date().getFullYear()
  const rows: Array<{ year: string; value: string }> = []
  for (let year = 1998; year <= currentYear; year += 1) {
    rows.push({ year: String(year), value: '' })
  }

  if (!yearlyPassengers || typeof yearlyPassengers !== 'object' || Array.isArray(yearlyPassengers)) {
    return rows
  }

  const yp = yearlyPassengers as YearlyPassengers
  return rows.map((row) => {
    const value = yp[row.year]
    return {
      year: row.year,
      value: value == null ? '' : String(value),
    }
  })
}

function buildFacilitiesRows(sandbox: Partial<SandboxStationDoc> | null | undefined): Array<{ key: string; value: string }> {
  const facilities = sandbox?.facilities
  if (!facilities || typeof facilities !== 'object' || Array.isArray(facilities)) return []

  return Object.entries(facilities as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: value == null ? '' : String(value),
  }))
}

export function buildPendingNewStationDraftPrefill(
  stationId: string,
  entry: PendingChangeEntry
): PendingNewStationDraftPrefill {
  const mergedStation: Partial<Station> = { ...entry.original, ...entry.updated, id: stationId }
  const sandbox = entry.sandboxUpdated ?? {}

  return {
    stationId,
    targetCollectionId: entry.targetCollectionId,
    form: {
      stationName: mergedStation.stationName ?? '',
      crsCode: mergedStation.crsCode ?? '',
      tiploc: mergedStation.tiploc ?? '',
      latitude: mergedStation.latitude ?? 0,
      longitude: mergedStation.longitude ?? 0,
      country: mergedStation.country ?? '',
      county: mergedStation.county ?? '',
      toc: mergedStation.toc ?? '',
      stnarea: mergedStation.stnarea ?? '',
      borough: mergedStation.borough ?? '',
      fareZone: mergedStation.fareZone ?? '',
    },
    additionalForm: { ...sandbox },
    yearlyPassengersRows: buildYearlyPassengerRows(mergedStation.yearlyPassengers),
    facilitiesRows: buildFacilitiesRows(sandbox),
  }
}

export function buildEditPendingNewStationNavigationState(
  stationId: string,
  entry: PendingChangeEntry,
  returnTo: string
): NewStationNavigationState {
  return {
    editPendingStationId: stationId,
    ...(isNetworkCollection(entry.targetCollectionId)
      ? { targetCollectionId: entry.targetCollectionId }
      : {}),
    returnTo,
  }
}

export function isPendingNewStationEntry(entry: PendingChangeEntry | undefined): entry is PendingChangeEntry {
  return Boolean(entry?.isNew)
}
