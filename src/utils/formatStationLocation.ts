export function isGreaterLondonCounty(county?: string | null): boolean {
  return (county ?? '').trim().toLowerCase() === 'greater london'
}

export function formatStationLocationDisplay(params: {
  county?: string | null
  country?: string | null
  londonBorough?: string | null
}): string {
  const county = (params.county ?? '').trim()
  const country = (params.country ?? '').trim()
  const borough = (params.londonBorough ?? '').trim()

  if (isGreaterLondonCounty(county) && borough) {
    return country ? `Greater London (${borough}), ${country}` : `Greater London (${borough})`
  }

  if (county && country) return `${county}, ${country}`
  if (county) return county
  if (country) return country
  return ''
}

