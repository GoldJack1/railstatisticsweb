/**
 * Infer which new-station form fields exist for a network by scanning Firestore documents.
 */

import type { StationCollectionId } from '../constants/stationCollections'
import { isNetworkCollection, NETWORK_STNAREA_DEFAULTS } from '../constants/stationCollections'
import type { StationUrlFieldKey } from './stationUrlField'
import { getStationUrlFieldKey, getStationUrlFieldLabel } from './stationUrlField'

export type StationDetailsTab =
  | 'details'
  | 'location'
  | 'usage'
  | 'additional'
  | 'stepFree'
  | 'service'
  | 'facilities'

export const STEP_FREE_SECTION_LABEL = 'Step Free Status'

export type StationCollectionFieldSchema = {
  defaultStnarea: string
  showBorough: boolean
  showFareZone: boolean
  showOperatorCode: boolean
  showStaffingLevel: boolean
  showNlc: boolean
  showGauge: boolean
  showMinConnectionTime: boolean
  showUrl: boolean
  urlFieldKey: StationUrlFieldKey
  urlFieldLabel: string
  showProvince: boolean
  showPostEirCode: boolean
  showUsageTab: boolean
  showStepFreeSection: boolean
  showStepFreeTab: boolean
  showStepFreeNote: boolean
  stepFreeTabLabel: string
  showLiftSection: boolean
  showToiletsSection: boolean
  showFacilitiesTab: boolean
  facilityKeys: string[]
  showServiceTab: boolean
  showConnectionBus: boolean
  showConnectionTaxi: boolean
  showConnectionUnderground: boolean
  showRequestStop: boolean
  showLimitedService: boolean
  showStationStatusSection: boolean
  requireCrsCode: boolean
  requireTiploc: boolean
}

const BOROUGH_KEYS = ['borough', 'Borough']
const FARE_ZONE_KEYS = ['fareZone', 'fare_zone', 'FareZone', 'farezone', 'Fare Zone']

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  return false
}

function collectPopulatedNestedKeys(docs: Record<string, unknown>[], parent: string): Set<string> {
  const keys = new Set<string>()
  for (const doc of docs) {
    const nested = doc[parent]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue
    for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
      if (!isEmpty(value)) keys.add(`${parent}.${key}`)
    }
  }
  return keys
}

function hasPopulatedTopLevel(docs: Record<string, unknown>[], keys: string[]): boolean {
  return keys.some((key) => docs.some((doc) => !isEmpty(doc[key])))
}

function hasPopulatedNested(docs: Record<string, unknown>[], parent: string, child: string): boolean {
  return docs.some((doc) => {
    const nested = doc[parent]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return false
    return !isEmpty((nested as Record<string, unknown>)[child])
  })
}

function collectFacilityKeys(docs: Record<string, unknown>[]): string[] {
  const keys = new Set<string>()
  for (const doc of docs) {
    const facilities = doc.facilities
    if (!facilities || typeof facilities !== 'object' || Array.isArray(facilities)) continue
    for (const [key, value] of Object.entries(facilities as Record<string, unknown>)) {
      if (!isEmpty(value)) keys.add(key)
    }
  }
  return [...keys].sort()
}

export const EMPTY_STATION_COLLECTION_FIELD_SCHEMA: StationCollectionFieldSchema = {
  defaultStnarea: '',
  showBorough: false,
  showFareZone: false,
  showOperatorCode: false,
  showStaffingLevel: false,
  showNlc: false,
  showGauge: false,
  showMinConnectionTime: false,
  showUrl: false,
  urlFieldKey: 'urlSlug',
  urlFieldLabel: 'URL slug',
  showProvince: false,
  showPostEirCode: false,
  showUsageTab: false,
  showStepFreeSection: false,
  showStepFreeTab: false,
  showStepFreeNote: false,
  stepFreeTabLabel: 'Step-free & Lift access',
  showLiftSection: false,
  showToiletsSection: false,
  showFacilitiesTab: false,
  facilityKeys: [],
  showServiceTab: false,
  showConnectionBus: false,
  showConnectionTaxi: false,
  showConnectionUnderground: false,
  showRequestStop: false,
  showLimitedService: false,
  showStationStatusSection: false,
  requireCrsCode: true,
  requireTiploc: true,
}

export function inferStationCollectionFieldSchema(
  docs: Record<string, unknown>[],
  collectionId?: StationCollectionId
): StationCollectionFieldSchema {
  const networkId = collectionId && isNetworkCollection(collectionId) ? collectionId : undefined
  const defaultStnarea = networkId ? NETWORK_STNAREA_DEFAULTS[networkId] : ''

  if (docs.length === 0) {
    const isHeritage = collectionId === 'stations_gbheritage'
    const urlFieldKey = collectionId ? getStationUrlFieldKey(collectionId) : 'urlSlug'
    return {
      ...EMPTY_STATION_COLLECTION_FIELD_SCHEMA,
      defaultStnarea,
      showUrl: isHeritage,
      urlFieldKey,
      urlFieldLabel: collectionId ? getStationUrlFieldLabel(collectionId) : 'URL slug',
      requireCrsCode: !isHeritage,
      requireTiploc: !isHeritage,
      showStepFreeSection: isHeritage,
      showStepFreeTab: false,
      stepFreeTabLabel: 'Step-free & Lift access',
      showStationStatusSection: isHeritage,
      showStaffingLevel: isHeritage,
      showNlc: isHeritage,
      showGauge: isHeritage,
      showRequestStop: isHeritage,
      showServiceTab: isHeritage,
    }
  }

  const isHeritage = collectionId === 'stations_gbheritage'
  const urlFieldKey: StationUrlFieldKey = isHeritage ? 'url' : 'urlSlug'
  const showUrl =
    hasPopulatedTopLevel(docs, ['url', 'urlSlug', 'url_slug']) || isHeritage
  const facilityKeys = collectFacilityKeys(docs)
  const showToiletsSection = [...collectPopulatedNestedKeys(docs, 'toilets')].length > 0
  const showStepFreeSection =
    isHeritage || [...collectPopulatedNestedKeys(docs, 'stepFree')].length > 0
  const showStepFreeNote = !isHeritage && hasPopulatedNested(docs, 'stepFree', 'stepFreeNote')
  const showLiftSection = !isHeritage && [...collectPopulatedNestedKeys(docs, 'lift')].length > 0
  const showConnectionBus = hasPopulatedNested(docs, 'connections', 'connectionBus')
  const showConnectionTaxi = hasPopulatedNested(docs, 'connections', 'connectionTaxi')
  const showConnectionUnderground = hasPopulatedNested(docs, 'connections', 'connectionUnderground')
  const showRequestStop = hasPopulatedNested(docs, 'is', 'isrequeststop')
  const showLimitedService = hasPopulatedNested(docs, 'is', 'Islimitedservice')
  const showStationStatusSection =
    isHeritage ||
    hasPopulatedNested(docs, 'stationstatus', 'status') ||
    hasPopulatedNested(docs, 'stationstatus', 'operationalperiod')
  const showStaffingLevel =
    isHeritage || hasPopulatedTopLevel(docs, ['staffingLevel', 'staffing_level'])
  const showNlc = isHeritage || hasPopulatedTopLevel(docs, ['nlc', 'NLC'])
  const showGauge = isHeritage || hasPopulatedTopLevel(docs, ['guage', 'Guage'])
  const showFacilitiesTab = facilityKeys.length > 0 || showToiletsSection

  const showUsageTab = docs.some((d) => {
    const yp = d.yearlyPassengers
    if (!yp || typeof yp !== 'object' || Array.isArray(yp)) return false
    return Object.values(yp as Record<string, unknown>).some((v) => !isEmpty(v))
  })

  return {
    defaultStnarea,
    showBorough:
      hasPopulatedTopLevel(docs, BOROUGH_KEYS) ||
      hasPopulatedTopLevel(docs, ['londonBorough', 'london_borough']),
    showFareZone: hasPopulatedTopLevel(docs, FARE_ZONE_KEYS),
    showOperatorCode: hasPopulatedTopLevel(docs, ['operatorCode', 'operator_code']),
    showStaffingLevel,
    showNlc,
    showGauge,
    showMinConnectionTime: hasPopulatedTopLevel(docs, ['min-connection-time', 'minConnectionTime']),
    showUrl,
    urlFieldKey,
    urlFieldLabel: collectionId ? getStationUrlFieldLabel(collectionId) : 'URL slug',
    showProvince: hasPopulatedTopLevel(docs, ['province']),
    showPostEirCode: hasPopulatedTopLevel(docs, ['post-eir_code']),
    showUsageTab,
    showStepFreeSection,
    showStepFreeTab: showLiftSection,
    showStepFreeNote,
    stepFreeTabLabel: 'Step-free & Lift access',
    showLiftSection,
    showToiletsSection,
    showFacilitiesTab,
    facilityKeys,
    showServiceTab:
      showConnectionBus ||
      showConnectionTaxi ||
      showConnectionUnderground ||
      showRequestStop ||
      showLimitedService ||
      showStationStatusSection ||
      showStaffingLevel,
    showConnectionBus,
    showConnectionTaxi,
    showConnectionUnderground,
    showRequestStop,
    showLimitedService,
    showStationStatusSection,
    requireCrsCode: collectionId !== 'stations_gbheritage',
    requireTiploc: collectionId !== 'stations_gbheritage',
  }
}

export function stationDetailsShowsAdditionalTab(fieldSchema: StationCollectionFieldSchema): boolean {
  return (
    fieldSchema.showOperatorCode ||
    fieldSchema.showMinConnectionTime ||
    fieldSchema.showProvince ||
    fieldSchema.showPostEirCode
  )
}

export function getVisibleStationDetailsTabs(fieldSchema: StationCollectionFieldSchema): StationDetailsTab[] {
  const tabs: StationDetailsTab[] = ['details']
  if (stationDetailsShowsAdditionalTab(fieldSchema)) tabs.push('additional')
  if (fieldSchema.showServiceTab) tabs.push('service')
  tabs.push('location')
  if (fieldSchema.showUsageTab) tabs.push('usage')
  if (fieldSchema.showStepFreeTab) tabs.push('stepFree')
  if (fieldSchema.showFacilitiesTab) tabs.push('facilities')
  return tabs
}
