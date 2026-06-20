import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { SandboxStationDoc, Station, YearlyPassengers } from '../types'
import { isLightRailCollection, LIGHT_RAIL_DOC_FIELDS, pickLightRailSandboxOnlyFields } from './lightRailStationFields'
import { readStationUrl } from './stationUrlField'

export interface StationFieldChange {
  label: string
  from: string
  to: string
}

export function formatStationFieldDiffValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && !Number.isNaN(value)) return value.toLocaleString()
  return String(value)
}

const CORE_STATION_FIELD_LABELS: Array<{ key: keyof Station; label: string }> = [
  { key: 'stationName', label: 'Station name' },
  { key: 'crsCode', label: 'CRS code' },
  { key: 'tiploc', label: 'Tiploc' },
  { key: 'toc', label: 'TOC' },
  { key: 'country', label: 'Country' },
  { key: 'county', label: 'County' },
  { key: 'stnarea', label: 'Station area' },
  { key: 'borough', label: 'Borough' },
  { key: 'fareZone', label: 'Fare zone' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
]

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

/** Flatten additional/sandbox fields into labelled rows for diff display. */
export function flattenAdditionalDocForDiff(doc: Partial<SandboxStationDoc> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!doc) return out

  const topLevel: Array<[keyof SandboxStationDoc, string]> = [
    ['operatorCode', 'Operator code'],
    ['staffingLevel', 'Staffing level'],
    ['nlc', 'NLC'],
    ['guage', 'Gauge'],
    ['min-connection-time', 'Min connection time'],
    ['province', 'Province'],
    ['post-eir_code', 'Post / Eircode'],
  ]

  for (const [key, label] of topLevel) {
    if (doc[key] !== undefined) out[label] = doc[key]
  }

  if (Object.keys(pickLightRailSandboxOnlyFields(doc as Record<string, unknown>)).length > 0) {
    const lightRailLabels: Record<string, string> = {
      [LIGHT_RAIL_DOC_FIELDS.dateOpened]: 'Date opened',
      [LIGHT_RAIL_DOC_FIELDS.linesServed]: 'Lines served',
      [LIGHT_RAIL_DOC_FIELDS.isLimitedService]: 'Limited service',
      [LIGHT_RAIL_DOC_FIELDS.platforms]: 'Platforms',
      [LIGHT_RAIL_DOC_FIELDS.isStaffed]: 'Staffed',
      [LIGHT_RAIL_DOC_FIELDS.isStepFree]: 'Step free status',
      [LIGHT_RAIL_DOC_FIELDS.hasLift]: 'Has lift',
      [LIGHT_RAIL_DOC_FIELDS.bus]: 'Bus',
      [LIGHT_RAIL_DOC_FIELDS.train]: 'Train',
    }
    for (const [key, label] of Object.entries(lightRailLabels)) {
      if ((doc as Record<string, unknown>)[key] !== undefined) out[label] = (doc as Record<string, unknown>)[key]
    }
  }

  if (doc.url !== undefined || doc.urlSlug !== undefined || readStationUrl(doc)) {
    out.URL = readStationUrl(doc) || null
  }

  const toilets = doc.toilets
  if (toilets && typeof toilets === 'object') {
    if (toilets.toiletsAccessible !== undefined) out['Toilets · Accessible'] = toilets.toiletsAccessible
    if (toilets.toiletsChangingPlace !== undefined) out['Toilets · Changing Place'] = toilets.toiletsChangingPlace
    if (toilets.toiletsBabyChanging !== undefined) out['Toilets · Baby changing'] = toilets.toiletsBabyChanging
  }

  const stepFree = doc.stepFree
  if (stepFree && typeof stepFree === 'object') {
    if (stepFree.stepFreeCode !== undefined) out['Step Free Status · Code'] = stepFree.stepFreeCode
    if (stepFree.stepFreeNote !== undefined) out['Step Free Status · Note'] = stepFree.stepFreeNote
  }

  const lift = doc.lift
  if (lift && typeof lift === 'object') {
    if (lift.liftAvailable !== undefined) out['Lift · Available'] = lift.liftAvailable
    if (lift.liftNotes !== undefined) out['Lift · Notes'] = lift.liftNotes
    if (lift.liftDetails !== undefined) out['Lift · Details'] = lift.liftDetails
  }

  const connections = doc.connections
  if (connections && typeof connections === 'object') {
    if (connections.connectionBus !== undefined) out['Connections · Bus'] = connections.connectionBus
    if (connections.connectionTaxi !== undefined) out['Connections · Taxi'] = connections.connectionTaxi
    if (connections.connectionUnderground !== undefined) {
      out['Connections · Underground'] = connections.connectionUnderground
    }
  }

  const isBlock = doc.is
  if (isBlock && typeof isBlock === 'object') {
    if (isBlock.isrequeststop !== undefined) out['Service · Request stop'] = isBlock.isrequeststop
    if (isBlock.Islimitedservice !== undefined) out['Service · Limited service'] = isBlock.Islimitedservice
  }

  const stationStatus = doc.stationstatus
  if (stationStatus && typeof stationStatus === 'object') {
    if (stationStatus.status !== undefined) out['Station status · Status'] = stationStatus.status
    if (stationStatus.operationalperiod !== undefined) {
      out['Station status · Operational period'] = stationStatus.operationalperiod
    }
  }

  const facilities = doc.facilities
  if (facilities && typeof facilities === 'object' && !Array.isArray(facilities)) {
    for (const [key, value] of Object.entries(facilities)) {
      out[`Facilities · ${humanizeKey(key)}`] = value
    }
  }

  return out
}

function diffFlatFieldMaps(
  original: Record<string, unknown>,
  updated: Record<string, unknown>,
  isNew: boolean
): StationFieldChange[] {
  const changes: StationFieldChange[] = []
  const labels = new Set([...Object.keys(original), ...Object.keys(updated)])

  for (const label of [...labels].sort((a, b) => a.localeCompare(b))) {
    const fromStr = formatStationFieldDiffValue(original[label])
    const toStr = formatStationFieldDiffValue(updated[label])
    if (fromStr === toStr) continue
    changes.push({
      label,
      from: isNew ? '—' : fromStr,
      to: toStr,
    })
  }

  return changes
}

export function diffYearlyPassengerFields(
  original: YearlyPassengers | null | undefined,
  updated: YearlyPassengers | null | undefined,
  isNew = false
): StationFieldChange[] {
  const changes: StationFieldChange[] = []
  const years = new Set<string>()

  if (original && typeof original === 'object' && !Array.isArray(original)) {
    for (const y of Object.keys(original)) {
      if (/^\d{4}$/.test(y)) years.add(y)
    }
  }
  if (updated && typeof updated === 'object' && !Array.isArray(updated)) {
    for (const y of Object.keys(updated)) {
      if (/^\d{4}$/.test(y)) years.add(y)
    }
  }

  for (const year of [...years].sort()) {
    const fromVal = original?.[year]
    const toVal = updated?.[year]
    const fromStr = formatStationFieldDiffValue(fromVal)
    const toStr = formatStationFieldDiffValue(toVal)
    if (fromStr === toStr) continue
    changes.push({
      label: `Passengers (${year})`,
      from: isNew ? '—' : fromStr,
      to: toStr,
    })
  }

  return changes
}

export function diffCoreStationFields(
  original: Partial<Station>,
  updated: Partial<Station>,
  isNew = false,
  options?: { isLightRail?: boolean }
): StationFieldChange[] {
  const changes: StationFieldChange[] = []
  const skipKeys = options?.isLightRail
    ? new Set<keyof Station>(['crsCode', 'tiploc', 'toc', 'yearlyPassengers'])
    : null

  for (const { key, label } of CORE_STATION_FIELD_LABELS) {
    if (skipKeys?.has(key)) continue
    const displayLabel =
      options?.isLightRail && key === 'stationName' ? 'Stop name' : label
    const fromVal = original[key]
    const toVal = updated[key] ?? original[key]
    const fromStr = formatStationFieldDiffValue(fromVal)
    const toStr = formatStationFieldDiffValue(toVal)
    if (fromStr === toStr) continue
    changes.push({
      label: displayLabel,
      from: isNew ? '—' : fromStr,
      to: toStr,
    })
  }

  return changes
}

export function diffAdditionalDocFields(
  original: Partial<SandboxStationDoc> | null | undefined,
  updated: Partial<SandboxStationDoc> | null | undefined,
  isNew = false
): StationFieldChange[] {
  return diffFlatFieldMaps(flattenAdditionalDocForDiff(original), flattenAdditionalDocForDiff(updated), isNew)
}

export interface StationFieldChangesInput {
  originalStation: Partial<Station>
  updatedStation: Partial<Station>
  originalAdditional?: Partial<SandboxStationDoc> | null
  updatedAdditional?: Partial<SandboxStationDoc> | null
  isNew?: boolean
  isLightRail?: boolean
}

/** Build a per-field change list for station edit review or pending changes. */
export function getStationFieldChanges(input: StationFieldChangesInput): StationFieldChange[] {
  const isNew = input.isNew === true
  const originalPassengers =
    input.originalStation.yearlyPassengers &&
    typeof input.originalStation.yearlyPassengers === 'object' &&
    !Array.isArray(input.originalStation.yearlyPassengers)
      ? (input.originalStation.yearlyPassengers as YearlyPassengers)
      : null
  const updatedPassengers =
    input.updatedStation.yearlyPassengers !== undefined &&
    input.updatedStation.yearlyPassengers !== null &&
    typeof input.updatedStation.yearlyPassengers === 'object' &&
    !Array.isArray(input.updatedStation.yearlyPassengers)
      ? (input.updatedStation.yearlyPassengers as YearlyPassengers)
      : isNew
        ? null
        : originalPassengers

  return [
    ...diffCoreStationFields(input.originalStation, input.updatedStation, isNew, {
      isLightRail: input.isLightRail,
    }),
    ...diffYearlyPassengerFields(originalPassengers, updatedPassengers, isNew),
    ...diffAdditionalDocFields(input.originalAdditional, input.updatedAdditional, isNew),
  ]
}

export function getFieldChangesForPendingReview(
  entry: PendingChangeEntry,
  options?: { additionalDocFallback?: Partial<SandboxStationDoc> | null }
): StationFieldChange[] {
  const { original, updated, sandboxUpdated, sandboxOriginal, isNew } = entry
  const isLightRail = isLightRailCollection(entry.targetCollectionId)

  let originalAdditional = isNew ? null : sandboxOriginal ?? null
  if (
    isLightRail &&
    options?.additionalDocFallback &&
    (!originalAdditional ||
      Object.keys(pickLightRailSandboxOnlyFields(originalAdditional as Record<string, unknown>)).length === 0)
  ) {
    originalAdditional = pickLightRailSandboxOnlyFields(
      options.additionalDocFallback as Record<string, unknown>
    ) as Partial<SandboxStationDoc>
  }

  let mergedUpdatedAdditional: Partial<SandboxStationDoc> | null = null
  if (sandboxUpdated) {
    mergedUpdatedAdditional =
      originalAdditional && !isNew
        ? ({ ...originalAdditional, ...sandboxUpdated } as Partial<SandboxStationDoc>)
        : sandboxUpdated
  }

  const updatedStation: Partial<Station> = {
    stationName: updated.stationName ?? original.stationName,
    crsCode: updated.crsCode ?? original.crsCode,
    tiploc: updated.tiploc ?? original.tiploc,
    toc: updated.toc ?? original.toc,
    country: updated.country ?? original.country,
    county: updated.county ?? original.county,
    stnarea: updated.stnarea ?? original.stnarea,
    borough: updated.borough ?? original.borough,
    fareZone: updated.fareZone ?? original.fareZone,
    latitude: updated.latitude ?? original.latitude,
    longitude: updated.longitude ?? original.longitude,
    yearlyPassengers: updated.yearlyPassengers !== undefined ? updated.yearlyPassengers : original.yearlyPassengers,
  }

  return getStationFieldChanges({
    originalStation: original,
    updatedStation,
    originalAdditional,
    updatedAdditional: mergedUpdatedAdditional,
    isNew: isNew === true,
    isLightRail,
  })
}
