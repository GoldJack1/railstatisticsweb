import { describe, expect, it } from 'vitest'
import type { Station } from '../../types'
import {
  filterStations,
  getDefaultStationFilterSelections,
  getStationFilterOptions,
  sortStations,
} from './stationSearchFiltering'

const makeStation = (overrides: Partial<Station>): Station => ({
  id: overrides.id || '1',
  stationName: overrides.stationName || 'Alpha',
  crsCode: overrides.crsCode || 'ALP',
  tiploc: overrides.tiploc ?? null,
  latitude: overrides.latitude ?? 0,
  longitude: overrides.longitude ?? 0,
  country: overrides.country ?? null,
  county: overrides.county ?? null,
  toc: overrides.toc ?? null,
  stnarea: overrides.stnarea ?? null,
  londonBorough: overrides.londonBorough ?? null,
  fareZone: overrides.fareZone ?? null,
  yearlyPassengers: overrides.yearlyPassengers ?? null,
})

describe('stationSearchFiltering', () => {
  const stations: Station[] = [
    makeStation({
      id: '1',
      stationName: 'Baker Street',
      crsCode: 'BKS',
      country: 'England',
      county: 'Greater London',
      toc: 'TfL Rail',
      londonBorough: 'Westminster',
      fareZone: '1',
      yearlyPassengers: { '2023': 200 },
    }),
    makeStation({
      id: '2',
      stationName: 'York',
      crsCode: 'YRK',
      country: 'England',
      county: 'North Yorkshire',
      toc: 'LNER',
      fareZone: 'Outside',
      yearlyPassengers: { '2023': 500 },
    }),
    makeStation({
      id: '3',
      stationName: 'Cardiff',
      crsCode: 'CDF',
      country: 'Wales',
      county: 'South Glamorgan',
      toc: 'Transport for Wales',
      fareZone: 'Outside',
      yearlyPassengers: { '2023': 300 },
    }),
  ]

  it('returns all stations with default all-selected filters', () => {
    const options = getStationFilterOptions(stations)
    const defaults = getDefaultStationFilterSelections(options)
    const results = filterStations(stations, '', defaults, options)
    expect(results).toHaveLength(3)
  })

  it('filters by subset selections only', () => {
    const options = getStationFilterOptions(stations)
    const defaults = getDefaultStationFilterSelections(options)
    const selections = { ...defaults, countries: ['Wales'] }
    const results = filterStations(stations, '', selections, options)
    expect(results.map((station) => station.id)).toEqual(['3'])
  })

  it('returns no stations when a category is explicitly cleared', () => {
    const options = getStationFilterOptions(stations)
    const defaults = getDefaultStationFilterSelections(options)
    const selections = { ...defaults, countries: [] }
    const results = filterStations(stations, '', selections, options)
    expect(results).toHaveLength(0)
  })

  it('applies london borough only when greater london is the only county selected', () => {
    const options = getStationFilterOptions(stations)
    const selections = {
      tocs: options.tocs,
      countries: options.countries,
      counties: ['Greater London'],
      londonBoroughs: ['Westminster'],
      fareZones: options.fareZones,
    }
    const londonOnlyResults = filterStations(stations, '', selections, options)
    expect(londonOnlyResults.map((station) => station.id)).toEqual(['1'])

    const multiCountySelections = { ...selections, counties: ['Greater London', 'North Yorkshire'] }
    const multiCountyResults = filterStations(stations, '', multiCountySelections, options)
    expect(multiCountyResults.map((station) => station.id)).toEqual(['1', '2'])
  })

  it('sorts stations by passenger count descending', () => {
    const sorted = sortStations(stations, 'passengers-desc')
    expect(sorted.map((station) => station.id)).toEqual(['2', '3', '1'])
  })
})
