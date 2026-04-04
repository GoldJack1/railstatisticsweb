import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import { formatYearlyPassengersForReview } from './formatYearlyPassengersReview'

export interface PendingFieldChange {
  label: string
  from: string
  to: string
}

export function getFieldChangesForPendingReview(entry: PendingChangeEntry): PendingFieldChange[] {
  const { original, updated, isNew } = entry

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  }

  const changes: PendingFieldChange[] = []
  const addChange = (label: string, fromValue: unknown, toValue: unknown) => {
    const fromStr = isNew ? '—' : formatValue(fromValue)
    const toStr = formatValue(toValue)
    if (fromStr !== toStr) {
      changes.push({ label, from: fromStr, to: toStr })
    }
  }

  addChange('Station name', original.stationName ?? '', updated.stationName ?? original.stationName ?? '')
  addChange('CRS code', original.crsCode ?? '', updated.crsCode ?? original.crsCode ?? '')
  addChange('Tiploc', original.tiploc ?? '', updated.tiploc ?? original.tiploc ?? '')
  addChange('TOC', original.toc ?? '', updated.toc ?? original.toc ?? '')
  addChange('Country', original.country ?? '', updated.country ?? original.country ?? '')
  addChange('County', original.county ?? '', updated.county ?? original.county ?? '')
  addChange('Station area', original.stnarea ?? '', updated.stnarea ?? original.stnarea ?? '')
  addChange('London Borough', original.londonBorough ?? '', updated.londonBorough ?? original.londonBorough ?? '')
  addChange('Fare Zone', original.fareZone ?? '', updated.fareZone ?? original.fareZone ?? '')
  addChange('Latitude', original.latitude ?? '', updated.latitude ?? original.latitude ?? '')
  addChange('Longitude', original.longitude ?? '', updated.longitude ?? original.longitude ?? '')

  const origYearly =
    !isNew && original.yearlyPassengers && typeof original.yearlyPassengers === 'object' && !Array.isArray(original.yearlyPassengers)
      ? original.yearlyPassengers
      : null
  const updYearly =
    updated.yearlyPassengers !== undefined && updated.yearlyPassengers !== null && typeof updated.yearlyPassengers === 'object' && !Array.isArray(updated.yearlyPassengers)
      ? updated.yearlyPassengers
      : origYearly

  const originalPassengersJson = origYearly !== null ? JSON.stringify(origYearly) : ''
  const updatedPassengersJson = updYearly !== null ? JSON.stringify(updYearly) : originalPassengersJson

  if (originalPassengersJson !== updatedPassengersJson) {
    changes.push({
      label: 'Yearly passengers',
      from: formatYearlyPassengersForReview(origYearly),
      to: formatYearlyPassengersForReview(updYearly)
    })
  }

  return changes
}
