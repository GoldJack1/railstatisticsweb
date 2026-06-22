import { describe, expect, it } from 'vitest'
import type { Station } from '../types'
import {
  getTableColumnValue,
  resolveTableColumnsFromSlots,
  sortStationsByTableColumn,
  toggleTableSort,
} from './stationsTableColumns'
import {
  addTableColumnSlot,
  getAvailableTableColumnKeys,
  getDefaultTableColumnSlots,
  getTableFieldOptionLabelsForNetwork,
  getTableFieldSchemaForNetworkView,
  MAX_TABLE_COLUMN_SLOT_COUNT,
  STATIONS_TABLE_COLUMN_CATALOG,
} from './stationsTableColumnCatalog'

const baseStation = (overrides: Partial<Station> = {}): Station => ({
  id: '1',
  stationName: 'Alpha',
  crsCode: 'ALP',
  tiploc: null,
  latitude: 0,
  longitude: 0,
  country: 'England',
  county: 'Yorkshire',
  toc: 'Northern',
  stnarea: 'GBNR',
  yearlyPassengers: null,
  ...overrides,
})

describe('stationsTableColumns', () => {
  it('includes detail-page field options in the catalog', () => {
    expect(STATIONS_TABLE_COLUMN_CATALOG.length).toBeGreaterThan(30)
    expect(STATIONS_TABLE_COLUMN_CATALOG.some((entry) => entry.key === 'province')).toBe(true)
  })

  it('defaults to eight header slots on the all tab', () => {
    expect(getDefaultTableColumnSlots('all')).toEqual([
      { field: 'stnarea' },
      { field: 'id' },
      { field: 'name' },
      { field: 'crs' },
      { field: 'tiploc' },
      { field: 'locale' },
      { field: 'toc' },
      { field: 'lines' },
    ])
    expect(getDefaultTableColumnSlots('all').length).toBe(8)
  })

  it('defaults to six SuperTram header slots', () => {
    expect(getDefaultTableColumnSlots('lightrail_GBSHEFFSUPERTRAM')).toEqual([
      { field: 'id' },
      { field: 'name' },
      { field: 'locale' },
      { field: 'dateOpened' },
      { field: 'lines' },
      { field: 'platforms' },
    ])
  })

  it('defaults to five GB Heritage header slots', () => {
    expect(getDefaultTableColumnSlots('stations_gbheritage')).toEqual([
      { field: 'id' },
      { field: 'name' },
      { field: 'locale' },
      { field: 'toc' },
      { field: 'gauge' },
    ])
  })

  it('defaults to five Irish Rail and NI Translink header slots', () => {
    const expected = [
      { field: 'id' },
      { field: 'name' },
      { field: 'locale' },
      { field: 'crs' },
      { field: 'toc' },
    ]

    expect(getDefaultTableColumnSlots('stations_roiirerail')).toEqual(expected)
    expect(getDefaultTableColumnSlots('stations_nitranslink')).toEqual(expected)
  })

  it('defaults to seven GB National Rail header slots', () => {
    expect(getDefaultTableColumnSlots('stations_gbnr')).toEqual([
      { field: 'id' },
      { field: 'crs' },
      { field: 'name' },
      { field: 'locale' },
      { field: 'toc' },
      { field: 'fareZone' },
      { field: 'latestPassengers' },
    ])
  })

  it('can expand table slots up to eight columns', () => {
    let slots = getDefaultTableColumnSlots('all')

    slots = addTableColumnSlot(slots)
    slots = addTableColumnSlot(slots)
    slots = addTableColumnSlot(slots)

    expect(slots).toHaveLength(8)
    expect(new Set(slots.map((slot) => slot.field)).size).toBe(8)
    expect(addTableColumnSlot(slots)).toHaveLength(MAX_TABLE_COLUMN_SLOT_COUNT)
  })

  it('resolves assigned header slots in order', () => {
    const columns = resolveTableColumnsFromSlots([
      { field: 'name' },
      { field: 'network' },
      { field: 'id' },
      { field: 'toc' },
      { field: 'crs' },
    ])

    expect(columns.map((column) => column.key)).toEqual(['name', 'network', 'id', 'toc', 'crs'])
    expect(columns.map((column) => column.slotIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('sorts numeric ids ascending', () => {
    const stations = [
      baseStation({ id: '12', stationName: 'B' }),
      baseStation({ id: '2', stationName: 'A' }),
      baseStation({ id: '10', stationName: 'C' }),
    ]

    const sorted = sortStationsByTableColumn(stations, { column: 'id', direction: 'asc' })
    expect(sorted.map((station) => station.id)).toEqual(['2', '10', '12'])
  })

  it('sorts date opened oldest to newest ascending', () => {
    const stations = [
      baseStation({ id: '1', dateOpened: '15/03/1995' }),
      baseStation({ id: '2', dateOpened: '01/01/1994' }),
      baseStation({ id: '3', dateOpened: '22/11/2002' }),
    ]

    const sorted = sortStationsByTableColumn(stations, { column: 'dateOpened', direction: 'asc' })
    expect(sorted.map((station) => station.dateOpened)).toEqual([
      '01/01/1994',
      '15/03/1995',
      '22/11/2002',
    ])
  })

  it('toggles sort direction when clicking the same column', () => {
    expect(toggleTableSort({ column: 'name', direction: 'asc' }, 'name')).toEqual({
      column: 'name',
      direction: 'desc',
    })
  })

  it('reads extended detail fields', () => {
    const station = baseStation({ operatorCode: 'NT', province: 'Ulster' })
    expect(getTableColumnValue(station, 'operatorCode')).toBe('NT')
    expect(getTableColumnValue(station, 'province')).toBe('Ulster')
  })

  it('reads latest passengers from string and null yearly values', () => {
    const station = baseStation({
      yearlyPassengers: { '2024': null, '2023': '12345' },
    })

    expect(getTableColumnValue(station, 'latestPassengers')).toBe('12345')
  })

  it('formats locale for GB stations', () => {
    const station = baseStation({
      country: 'England',
      county: 'South Yorkshire',
      borough: 'Park Hill',
    })

    expect(getTableColumnValue(station, 'locale')).toBe('England, South Yorkshire (Park Hill)')
  })
})

describe('stationsTableColumnCatalog network filters', () => {
  it('shows locale instead of separate location fields on the all network tab', () => {
    const labels = getTableFieldOptionLabelsForNetwork(
      'all',
      getTableFieldSchemaForNetworkView('all')
    )

    expect(labels).toContain('Network')
    expect(labels).toContain('Locale')
    expect(labels).toContain('CRS code')
    expect(labels).toContain('Lines served')
    expect(labels).not.toContain('Country')
    expect(labels).not.toContain('County')
    expect(labels).not.toContain('Borough')
    expect(labels).not.toContain('Province')
    expect(labels.length).toBe(STATIONS_TABLE_COLUMN_CATALOG.length - 4)
  })

  it('shows locale instead of separate location fields on network tabs', () => {
    const schema = getTableFieldSchemaForNetworkView('stations_gbnr')
    const keys = getAvailableTableColumnKeys('stations_gbnr', schema)

    expect(keys).toContain('locale')
    expect(keys).not.toContain('country')
    expect(keys).not.toContain('county')
    expect(keys).not.toContain('borough')
    expect(keys).not.toContain('province')
  })

  it('hides rail-only fields on the SuperTram tab', () => {
    const schema = getTableFieldSchemaForNetworkView('lightrail_GBSHEFFSUPERTRAM')
    const keys = getAvailableTableColumnKeys('lightrail_GBSHEFFSUPERTRAM', schema)

    expect(keys).toContain('locale')
    expect(keys).toContain('lines')
    expect(keys).toContain('fareZone')
    expect(keys).not.toContain('country')
    expect(keys).not.toContain('borough')
    expect(keys).not.toContain('crs')
    expect(keys).not.toContain('toc')
    expect(keys).not.toContain('network')
  })

  it('uses province locale format on Irish Rail tab options', () => {
    const schema = getTableFieldSchemaForNetworkView('stations_roiirerail')
    const keys = getAvailableTableColumnKeys('stations_roiirerail', schema)

    expect(keys).toContain('locale')
    expect(keys).not.toContain('province')
    expect(keys).not.toContain('county')
  })
})
