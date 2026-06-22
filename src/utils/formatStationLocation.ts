import type { NetworkCollectionId } from '../constants/stationCollections'

const PROVINCE_LOCALE_COLLECTION_IDS = new Set<NetworkCollectionId>([
  'stations_roiirerail',
  'stations_nitranslink',
])

export type StationLocaleParts = {
  country?: string | null
  county?: string | null
  borough?: string | null
  province?: string | null
  sourceCollectionId?: NetworkCollectionId
}

export function isGreaterLondonCounty(county?: string | null): boolean {
  return (county ?? '').trim().toLowerCase() === 'greater london'
}

export function usesProvinceLocaleFormat(station: StationLocaleParts): boolean {
  if (station.sourceCollectionId && PROVINCE_LOCALE_COLLECTION_IDS.has(station.sourceCollectionId)) {
    return true
  }

  const country = (station.country ?? '').trim().toLowerCase()
  return country.includes('ireland')
}

function formatLocaleDisplay(country: string, region: string, locality: string): string {
  if (!country && !region && !locality) return ''

  if (country && region && locality) {
    return `${country}, ${region} (${locality})`
  }
  if (country && region) return `${country}, ${region}`
  if (country && locality) return `${country} (${locality})`
  if (region && locality) return `${region} (${locality})`

  return country || region || locality
}

export function formatStationLocaleDisplay(station: StationLocaleParts): string {
  const country = (station.country ?? '').trim()
  const county = (station.county ?? '').trim()
  const borough = (station.borough ?? '').trim()
  const province = (station.province ?? '').trim()

  if (usesProvinceLocaleFormat(station)) {
    return formatLocaleDisplay(country, province, county)
  }

  return formatLocaleDisplay(country, county, borough)
}

export function formatStationLocationDisplay(params: {
  county?: string | null
  country?: string | null
  borough?: string | null
}): string {
  const county = (params.county ?? '').trim()
  const country = (params.country ?? '').trim()
  const borough = (params.borough ?? '').trim()

  if (isGreaterLondonCounty(county) && borough) {
    return country ? `Greater London (${borough}), ${country}` : `Greater London (${borough})`
  }

  if (county && country) return `${county}, ${country}`
  if (county) return county
  if (country) return country
  return ''
}

