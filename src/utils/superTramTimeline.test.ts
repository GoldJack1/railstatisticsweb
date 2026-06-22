import { describe, expect, it } from 'vitest'
import type { Station } from '../types'
import {
  buildSuperTramTimelineSteps,
  countStationsVisibleAtTimelineCutoff,
  isStationVisibleAtTimelineCutoff,
} from './superTramTimeline'

function baseStation(overrides: Partial<Station> = {}): Station {
  return {
    id: '1',
    stationName: 'Test Stop',
    crsCode: '',
    tiploc: null,
    latitude: 53.4,
    longitude: -1.4,
    country: 'England',
    county: 'South Yorkshire',
    toc: null,
    stnarea: 'GBSHEFFSUPERTRAM',
    yearlyPassengers: null,
    sourceCollectionId: 'lightrail_GBSHEFFSUPERTRAM',
    ...overrides,
  }
}

describe('superTramTimeline', () => {
  it('builds sorted unique opening steps', () => {
    const stations = [
      baseStation({ id: 'a', dateOpened: '22/08/1994' }),
      baseStation({ id: 'b', dateOpened: '21/03/1994' }),
      baseStation({ id: 'c', dateOpened: '21/03/1994' }),
    ]

    const steps = buildSuperTramTimelineSteps(stations)
    expect(steps).toHaveLength(2)
    expect(steps[0].label).toBe('21 Mar 1994')
    expect(steps[1].label).toBe('22 Aug 1994')
  })

  it('shows only stops opened on or before the cutoff', () => {
    const stations = [
      baseStation({ id: 'a', dateOpened: '21/03/1994' }),
      baseStation({ id: 'b', dateOpened: '22/08/1994' }),
    ]
    const steps = buildSuperTramTimelineSteps(stations)

    expect(
      countStationsVisibleAtTimelineCutoff(stations, steps[0].cutoffMs, false)
    ).toBe(1)
    expect(
      countStationsVisibleAtTimelineCutoff(stations, steps[1].cutoffMs, true)
    ).toBe(2)
  })

  it('hides undated stops until the timeline reaches the end', () => {
    const station = baseStation({ id: 'a', dateOpened: '' })
    expect(isStationVisibleAtTimelineCutoff(station, Date.UTC(1994, 2, 21), false)).toBe(false)
    expect(isStationVisibleAtTimelineCutoff(station, Date.UTC(1994, 2, 21), true)).toBe(true)
  })
})
