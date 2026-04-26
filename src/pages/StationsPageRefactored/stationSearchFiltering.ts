import type { Station } from '../../types'

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'passengers-asc'
  | 'passengers-desc'
  | 'toc-asc'
  | 'toc-desc'

export interface StationFilterOptions {
  tocs: string[]
  countries: string[]
  counties: string[]
  londonBoroughs: string[]
  fareZones: string[]
}

export interface StationFilterSelections {
  tocs: string[]
  countries: string[]
  counties: string[]
  londonBoroughs: string[]
  fareZones: string[]
}

export const isOnlyGreaterLondonSelected = (counties: string[]) =>
  counties.length === 1 && counties[0] === 'Greater London'

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0

const sortAlphabetically = (values: string[]) =>
  [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

const shouldApplyCategoryFilter = (selected: string[], allOptions: string[]) =>
  selected.length !== allOptions.length

const getLatestPassengers = (station: Station): number => {
  if (station.yearlyPassengers && typeof station.yearlyPassengers === 'object') {
    const years = Object.keys(station.yearlyPassengers)
      .filter((year) => /^\d{4}$/.test(year))
      .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))

    if (years.length > 0) {
      const latestValue = station.yearlyPassengers[years[0]]
      return typeof latestValue === 'number' ? latestValue : 0
    }
  }
  return 0
}

export const getStationFilterOptions = (stations: Station[]): StationFilterOptions => ({
  tocs: sortAlphabetically([...new Set(stations.map((station) => station.toc).filter(isNonEmptyString))]),
  countries: sortAlphabetically([...new Set(stations.map((station) => station.country).filter(isNonEmptyString))]),
  counties: sortAlphabetically([...new Set(stations.map((station) => station.county).filter(isNonEmptyString))]),
  londonBoroughs: sortAlphabetically([...new Set(stations.map((station) => station.londonBorough).filter(isNonEmptyString))]),
  fareZones: sortAlphabetically([...new Set(stations.map((station) => station.fareZone).filter(isNonEmptyString))]),
})

export const getDefaultStationFilterSelections = (
  options: StationFilterOptions
): StationFilterSelections => ({
  tocs: options.tocs,
  countries: options.countries,
  counties: options.counties,
  londonBoroughs: options.londonBoroughs,
  fareZones: options.fareZones,
})

export const filterStations = (
  stations: Station[],
  searchTerm: string,
  selections: StationFilterSelections,
  options: StationFilterOptions
): Station[] => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  return stations.filter((station) => {
    const searchTermMatch =
      normalizedSearchTerm.length === 0 ||
      station.stationName?.toLowerCase().includes(normalizedSearchTerm) ||
      station.crsCode?.toLowerCase().includes(normalizedSearchTerm) ||
      station.toc?.toLowerCase().includes(normalizedSearchTerm) ||
      station.county?.toLowerCase().includes(normalizedSearchTerm)

    const tocMatch =
      !shouldApplyCategoryFilter(selections.tocs, options.tocs) ||
      selections.tocs.includes(station.toc || '')
    const countryMatch =
      !shouldApplyCategoryFilter(selections.countries, options.countries) ||
      selections.countries.includes(station.country || '')
    const countyMatch =
      !shouldApplyCategoryFilter(selections.counties, options.counties) ||
      selections.counties.includes(station.county || '')

    const londonBoroughFilterEnabled = isOnlyGreaterLondonSelected(selections.counties)
    const boroughSubsetSelected = shouldApplyCategoryFilter(
      selections.londonBoroughs,
      options.londonBoroughs
    )
    const londonBoroughMatch =
      !londonBoroughFilterEnabled ||
      station.county !== 'Greater London' ||
      !boroughSubsetSelected ||
      selections.londonBoroughs.includes(station.londonBorough || '')

    const fareZoneMatch =
      !shouldApplyCategoryFilter(selections.fareZones, options.fareZones) ||
      selections.fareZones.includes(station.fareZone || '')

    return (
      searchTermMatch &&
      tocMatch &&
      countryMatch &&
      countyMatch &&
      londonBoroughMatch &&
      fareZoneMatch
    )
  })
}

export const sortStations = (stations: Station[], sortOption: SortOption): Station[] =>
  [...stations].sort((a, b) => {
    switch (sortOption) {
      case 'name-asc':
        return (a.stationName || '').localeCompare(b.stationName || '')
      case 'name-desc':
        return (b.stationName || '').localeCompare(a.stationName || '')
      case 'toc-asc':
        return (a.toc || '').localeCompare(b.toc || '')
      case 'toc-desc':
        return (b.toc || '').localeCompare(a.toc || '')
      case 'passengers-asc':
        return getLatestPassengers(a) - getLatestPassengers(b)
      case 'passengers-desc':
        return getLatestPassengers(b) - getLatestPassengers(a)
      default:
        return 0
    }
  })
