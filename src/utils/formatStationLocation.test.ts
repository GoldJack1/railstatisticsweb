import { describe, expect, it } from 'vitest'
import { formatStationLocaleDisplay } from './formatStationLocation'

describe('formatStationLocaleDisplay', () => {
  it('formats GB stations as country, county (borough)', () => {
    expect(
      formatStationLocaleDisplay({
        country: 'England',
        county: 'South Yorkshire',
        borough: 'Park Hill',
      })
    ).toBe('England, South Yorkshire (Park Hill)')
  })

  it('formats Irish Rail stations as country, province (county)', () => {
    expect(
      formatStationLocaleDisplay({
        country: 'Republic of Ireland',
        province: 'Munster',
        county: 'Cork',
        sourceCollectionId: 'stations_roiirerail',
      })
    ).toBe('Republic of Ireland, Munster (Cork)')
  })

  it('omits empty locality segments', () => {
    expect(
      formatStationLocaleDisplay({
        country: 'England',
        county: 'South Yorkshire',
      })
    ).toBe('England, South Yorkshire')
  })
})
