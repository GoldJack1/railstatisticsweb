import type { Station } from '../types'
import { isLightRailStop } from './stationCardForNetwork'
import { formatStationLocaleDisplay } from './formatStationLocation'
import { formatFareZoneDisplay } from './formatFareZone'
import { parseStoredDateForSort } from './dateDdMmYyyy'
import { readStationUrl } from './stationUrlField'
import { getLatestYearlyPassengerCount } from './yearlyPassengers'
import { NETWORK_LABELS } from '../constants/stationCollections'
import type { NetworkCollectionId } from '../constants/stationCollections'
import {
  STATIONS_TABLE_COLUMN_CATALOG_BY_KEY,
  type StationsTableColumnKey,
  type StationsTableColumnSlot,
  type StationsTableColumnSortMode,
} from './stationsTableColumnCatalog'

export type StationsTableSortDirection = 'asc' | 'desc'

export interface StationsTableSort {
  column: StationsTableColumnKey
  direction: StationsTableSortDirection
}

export interface StationsTableColumnDefinition {
  key: StationsTableColumnKey
  label: string
  sortMode: StationsTableColumnSortMode
  cellClassName?: string
  renderAsLinesChips?: boolean
  slotIndex: number
}

export function getTableColumnValue(station: Station, column: StationsTableColumnKey): string {
  const isLightRail = isLightRailStop(station)

  switch (column) {
    case 'id':
      return station.id.trim()
    case 'name':
      return (station.stationName ?? '').trim()
    case 'crs':
      return isLightRail ? '' : (station.crsCode ?? '').trim()
    case 'tiploc':
      return isLightRail ? '' : (station.tiploc ?? '').trim()
    case 'toc':
      return isLightRail ? '' : (station.toc ?? '').trim()
    case 'country':
      return (station.country ?? '').trim()
    case 'county':
      return (station.county ?? '').trim()
    case 'locale':
      return formatStationLocaleDisplay(station)
    case 'stnarea':
      return (station.stnarea ?? '').trim()
    case 'borough':
      return (station.borough ?? '').trim()
    case 'fareZone': {
      const zone = (station.fareZone ?? '').trim()
      return zone ? formatFareZoneDisplay(zone) || zone : ''
    }
    case 'lines':
      return isLightRail ? (station.linesServed ?? '').trim() : ''
    case 'platforms':
      return (station.platforms ?? '').trim()
    case 'nlc':
      return (station.nlc ?? '').trim()
    case 'gauge':
      return (station.gauge ?? '').trim()
    case 'url':
      return readStationUrl({
        url: station.stationUrl ?? undefined,
        urlSlug: station.urlSlug ?? undefined,
      }).trim()
    case 'latitude':
      return station.latitude ? station.latitude.toFixed(6) : ''
    case 'longitude':
      return station.longitude ? station.longitude.toFixed(6) : ''
    case 'operatorCode':
      return (station.operatorCode ?? '').trim()
    case 'minConnectionTime':
      return (station.minConnectionTime ?? '').trim()
    case 'province':
      return (station.province ?? '').trim()
    case 'postEirCode':
      return (station.postEirCode ?? '').trim()
    case 'stepFreeStatus':
      return (station.stepFreeCode ?? '').trim()
    case 'stepFreeNote':
      return (station.stepFreeNote ?? '').trim()
    case 'hasLift':
      return (station.hasLift ?? '').trim()
    case 'liftAvailable':
      return (station.liftAvailable ?? '').trim()
    case 'liftNotes':
      return (station.liftNotes ?? '').trim()
    case 'liftDetails':
      return (station.liftDetails ?? '').trim()
    case 'dateOpened':
      return (station.dateOpened ?? '').trim()
    case 'limitedService':
      return (station.isLimitedService ?? '').trim()
    case 'staffed':
      return (station.isStaffed ?? '').trim()
    case 'staffingLevel':
      return (station.staffingLevel ?? '').trim()
    case 'connectionBus':
      return (station.connectionBus ?? '').trim()
    case 'connectionTaxi':
      return (station.connectionTaxi ?? '').trim()
    case 'connectionUnderground':
      return (station.connectionUnderground ?? '').trim()
    case 'connectionTrain':
      return (station.connectionTrain ?? '').trim()
    case 'stationStatus':
      return (station.stationStatus ?? '').trim()
    case 'operationalPeriod':
      return (station.operationalPeriod ?? '').trim()
    case 'requestStop':
      return (station.requestStop ?? '').trim()
    case 'toiletsAccessible':
      return (station.toiletsAccessible ?? '').trim()
    case 'toiletsChangingPlace':
      return (station.toiletsChangingPlace ?? '').trim()
    case 'toiletsBabyChanging':
      return (station.toiletsBabyChanging ?? '').trim()
    case 'latestPassengers': {
      const count = getLatestYearlyPassengerCount(station.yearlyPassengers)
      return count != null ? String(count) : ''
    }
    case 'network': {
      const networkId = station.sourceCollectionId
      if (!networkId || !(networkId in NETWORK_LABELS)) return ''
      return NETWORK_LABELS[networkId as NetworkCollectionId]
    }
    default:
      return ''
  }
}

function compareValues(a: string, b: string, sortMode: StationsTableColumnSortMode): number {
  if (sortMode === 'date') {
    const dateA = parseStoredDateForSort(a)
    const dateB = parseStoredDateForSort(b)
    if (dateA !== null && dateB !== null) return dateA - dateB
    if (dateA !== null) return -1
    if (dateB !== null) return 1
    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  }

  if (sortMode === 'numeric') {
    const numA = Number(a)
    const numB = Number(b)
    const aIsNum = a !== '' && Number.isFinite(numA)
    const bIsNum = b !== '' && Number.isFinite(numB)
    if (aIsNum && bIsNum) return numA - numB
    if (aIsNum) return -1
    if (bIsNum) return 1
  }

  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
}

function compareStationsByColumn(
  a: Station,
  b: Station,
  column: StationsTableColumnKey,
  direction: StationsTableSortDirection
): number {
  const sortMode = STATIONS_TABLE_COLUMN_CATALOG_BY_KEY[column].sortMode
  const valueA = getTableColumnValue(a, column)
  const valueB = getTableColumnValue(b, column)

  if (!valueA && !valueB) return 0
  if (!valueA) return 1
  if (!valueB) return -1

  const result = compareValues(valueA, valueB, sortMode)
  return direction === 'asc' ? result : -result
}

export function sortStationsByTableColumn(
  stations: Station[],
  sort: StationsTableSort
): Station[] {
  return [...stations].sort((a, b) => compareStationsByColumn(a, b, sort.column, sort.direction))
}

export function resolveTableColumnsFromSlots(
  slots: StationsTableColumnSlot[]
): StationsTableColumnDefinition[] {
  return slots.map((slot, slotIndex) => {
    const catalog = STATIONS_TABLE_COLUMN_CATALOG_BY_KEY[slot.field]
    return {
      key: slot.field,
      label: catalog.defaultLabel,
      sortMode: catalog.sortMode,
      cellClassName: catalog.cellClassName,
      renderAsLinesChips: catalog.renderAsLinesChips,
      slotIndex,
    }
  })
}

export function formatTableCellValue(value: string): string {
  return value.trim() || '—'
}

export function toggleTableSort(
  current: StationsTableSort,
  column: StationsTableColumnKey
): StationsTableSort {
  if (current.column === column) {
    return {
      column,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    }
  }

  return { column, direction: 'asc' }
}

export type {
  StationsTableColumnKey,
  StationsTableColumnSlot,
} from './stationsTableColumnCatalog'
