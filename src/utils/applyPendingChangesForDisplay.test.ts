import { describe, expect, it } from 'vitest'
import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { Station } from '../types'
import {
  findPendingEntryForStation,
  mergePendingChangesForStationsList,
  mergeStationWithPendingUpdate,
} from './applyPendingChangesForDisplay'

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
  sourceCollectionId: 'stations_gbnr',
  ...overrides,
})

describe('applyPendingChangesForDisplay', () => {
  it('merges pending edits into existing stations on the list', () => {
    const station = baseStation({ id: '42', stationName: 'Before' })
    const pendingChanges: Record<string, PendingChangeEntry> = {
      '42': {
        targetCollectionId: 'stations_gbnr',
        original: station,
        updated: { stationName: 'After', toc: 'LNER' },
        sandboxUpdated: null,
        sandboxOriginal: null,
      },
    }

    const merged = mergePendingChangesForStationsList([station], pendingChanges, 'stations_gbnr')

    expect(merged).toHaveLength(1)
    expect(merged[0].stationName).toBe('After')
    expect(merged[0].toc).toBe('LNER')
  })

  it('does not apply a pending edit from another network to a duplicate id', () => {
    const gbnrStation = baseStation({ id: '1', stationName: 'GB Stop', sourceCollectionId: 'stations_gbnr' })
    const irishStation = baseStation({
      id: '1',
      stationName: 'Irish Stop',
      sourceCollectionId: 'stations_roiirerail',
      stnarea: 'ROIIRERAIL',
    })
    const pendingChanges: Record<string, PendingChangeEntry> = {
      '1': {
        targetCollectionId: 'stations_gbnr',
        original: gbnrStation,
        updated: { stationName: 'Edited GB only' },
        sandboxUpdated: null,
        sandboxOriginal: null,
      },
    }

    expect(findPendingEntryForStation(gbnrStation, pendingChanges)?.updated.stationName).toBe('Edited GB only')
    expect(findPendingEntryForStation(irishStation, pendingChanges)).toBeUndefined()
    expect(mergeStationWithPendingUpdate(irishStation, undefined).stationName).toBe('Irish Stop')
  })
})
