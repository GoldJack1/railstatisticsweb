import React, { useEffect, useState } from 'react'
import type { SandboxStationDoc, Station, YearlyPassengers } from '../../../types'
import type { PendingChangeEntry } from '../../../contexts/PendingStationChangesContext'
import type { StationCollectionId } from '../../../constants/stationCollections'
import { usePendingStationChanges } from '../../../contexts/PendingStationChangesContext'
import { useStationCollection } from '../../../contexts/StationCollectionContext'
import { fetchStationDocumentById } from '../../../services/firebase'
import { BUTBaseButton as Button } from '../../buttons'
import LocationMapPicker from './LocationMapPicker'
import { LightRailDateOpenedInput } from './LightRailDateOpenedInput'
import { LightRailYesNoSelect } from './LightRailYesNoSelect'
import type { StationDetailsTab } from '../../../utils/stationCollectionFieldSchema'
import { stationDetailsShowsAdditionalTab, STEP_FREE_SECTION_LABEL } from '../../../utils/stationCollectionFieldSchema'
import type { StationCollectionFieldSchema } from '../../../utils/stationCollectionFieldSchema'
import { useStationFieldSchema } from '../../../hooks/useStationCollectionFieldSchema'
import { readStationUrl, readEditedStationUrl, writeStationUrlPayload } from '../../../utils/stationUrlField'
import { getStationNetworkCollectionId } from '../../../utils/stationAreaSlug'
import {
  LIGHT_RAIL_DOC_FIELDS,
  pickChangedLightRailSandboxFields,
  pickLightRailSandboxOnlyFields,
  readLightRailDocString,
} from '../../../utils/lightRailStationFields'
import { getStationFieldChanges } from '../../../utils/stationFieldDiffs'
import {
  getPendingFieldChangesForEntry,
  mergeAdditionalDocWithPendingUpdate,
  mergeStationWithPendingUpdate,
} from '../../../utils/applyPendingChangesForDisplay'
import { StationPendingChangesBanner } from './StationPendingChangesBanner'
import { createPortal } from 'react-dom'
import { LightRailLinesServedChipPicker } from '../../chips/LightRailLinesServedChipPicker'
import { LightRailPlatformsChipPicker } from '../../chips/LightRailPlatformsChipPicker'
import TXTINPWideButton from '../../textInputs/plain/TXTINPWideButton'

const emptyStationForm = (): Partial<Station> => ({
  stationName: '',
  crsCode: '',
  tiploc: '',
  latitude: 0,
  longitude: 0,
  country: '',
  county: '',
  toc: '',
  stnarea: '',
  borough: '',
  fareZone: '',
  yearlyPassengers: null
})

const pickAdditionalDetails = (
  doc: SandboxStationDoc | null,
  collectionId?: StationCollectionId
): Partial<SandboxStationDoc> => {
  if (!doc) return {}
  const picked: Partial<SandboxStationDoc> = {}
  if (collectionId === 'lightrail_GBSHEFFSUPERTRAM') {
    Object.assign(picked, pickLightRailSandboxOnlyFields(doc as Record<string, unknown>))
    return picked
  }
  const keys: Array<keyof SandboxStationDoc> = [
    'operatorCode',
    'staffingLevel',
    'nlc',
    'guage',
    'min-connection-time',
    'urlSlug',
    'url',
    'province',
    'post-eir_code',
    'toilets',
    'stepFree',
    'lift',
    'connections',
    'is',
    'stationstatus',
    'facilities'
  ]
  for (const k of keys) {
    const v = doc[k]
    if (v !== undefined) {
      ;(picked as Record<string, unknown>)[k] = v as unknown
    }
  }
  return picked
}

const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>()

  const sortDeep = (v: unknown): unknown => {
    if (v === null || v === undefined) return v
    if (Array.isArray(v)) return v.map(sortDeep)
    if (typeof v !== 'object') return v

    const obj = v as Record<string, unknown>
    if (seen.has(obj)) return '[Circular]'
    seen.add(obj)

    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortDeep(obj[key])
    }
    return out
  }

  return JSON.stringify(sortDeep(value), null, 2)
}

const toNumberOrString = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return raw
  if (typeof raw === 'number') return raw
  const s = String(raw).trim()
  if (s === '') return ''
  const n = Number(s.replace(/,/g, ''))
  return Number.isNaN(n) ? s : n
}

const UNSAVED_MESSAGE = 'Are you sure you want to go back? All data will not be saved.'

interface StationDetailsEditFormProps {
  station: Station
  onCancel: () => void
  onSaved: () => void
  /** When set (e.g. on details page), only this section is shown. When undefined (e.g. in modal), all sections shown. */
  activeTab?: StationDetailsTab
  /** When set, renders the action buttons into the given element id. */
  actionsPortalId?: string
  /** Called when unsaved changes state changes (for parent to show confirm on Back). */
  onUnsavedChangesChange?: (dirty: boolean) => void
  /** Per-network field visibility; inferred from Firestore when omitted. */
  fieldSchema?: StationCollectionFieldSchema
  /** Existing staged edits for this station (prefills form + shows banner). */
  pendingEntry?: PendingChangeEntry
}

const StationDetailsEditForm: React.FC<StationDetailsEditFormProps> = ({
  station,
  onCancel,
  onSaved,
  activeTab,
  actionsPortalId,
  onUnsavedChangesChange,
  fieldSchema: fieldSchemaProp,
  pendingEntry,
}) => {
  const { fieldSchema } = useStationFieldSchema(station, fieldSchemaProp)
  const showAdditionalFields = stationDetailsShowsAdditionalTab(fieldSchema)
  const showAll = activeTab === undefined
  const showDetails = showAll || activeTab === 'details'
  const showLocationTab = showAll || activeTab === 'location'
  const showUsage = fieldSchema.showUsageTab && (showAll || activeTab === 'usage')
  const showAdditional = showAdditionalFields && (showAll || activeTab === 'additional')
  const showStepFree = fieldSchema.showStepFreeTab && (showAll || activeTab === 'stepFree')
  const showService = fieldSchema.showServiceTab && (showAll || activeTab === 'service')
  const showFacilities = fieldSchema.showFacilitiesTab && (showAll || activeTab === 'facilities')
  const [form, setForm] = useState<Partial<Station>>(emptyStationForm)
  const [yearlyPassengersRows, setYearlyPassengersRows] = useState<Array<{ year: string; value: string }>>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [preparedYearlyPassengers, setPreparedYearlyPassengers] = useState<YearlyPassengers | null>(null)
  const [additionalForm, setAdditionalForm] = useState<Partial<SandboxStationDoc>>({})
  const [facilitiesRows, setFacilitiesRows] = useState<Array<{ key: string; value: string }>>([])
  const [preparedAdditionalDetails, setPreparedAdditionalDetails] = useState<Partial<SandboxStationDoc> | null>(null)
  const { upsertPendingChange } = usePendingStationChanges()
  const { collectionId } = useStationCollection()
  const stationCollectionId = getStationNetworkCollectionId(station, collectionId) ?? collectionId
  const urlFieldKey = fieldSchema.urlFieldKey
  const urlFieldLabel = fieldSchema.urlFieldLabel
  const [additionalDoc, setAdditionalDoc] = useState<SandboxStationDoc | null>(null)
  const [additionalLoading, setAdditionalLoading] = useState(false)

  useEffect(() => {
    const merged = mergeStationWithPendingUpdate(station, pendingEntry)
    setForm({
      stationName: merged.stationName ?? '',
      crsCode: merged.crsCode ?? '',
      tiploc: merged.tiploc ?? '',
      latitude: merged.latitude ?? 0,
      longitude: merged.longitude ?? 0,
      country: merged.country ?? '',
      county: merged.county ?? '',
      toc: merged.toc ?? '',
      stnarea: merged.stnarea ?? '',
      borough: merged.borough ?? '',
      fareZone: merged.fareZone ?? '',
      yearlyPassengers: merged.yearlyPassengers ?? null
    })
    const yp =
      merged.yearlyPassengers && typeof merged.yearlyPassengers === 'object' && !Array.isArray(merged.yearlyPassengers)
        ? (merged.yearlyPassengers as YearlyPassengers)
        : null
    const ypRows = yp
      ? Object.entries(yp)
          .filter(([k]) => /^\d{4}$/.test(k))
          .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
          .map(([year, value]) => ({ year, value: value == null ? '' : String(value) }))
      : []
    setYearlyPassengersRows(ypRows)
    setSaveError(null)
    setIsReviewing(false)
    setPreparedYearlyPassengers(
      merged.yearlyPassengers && typeof merged.yearlyPassengers === 'object' && !Array.isArray(merged.yearlyPassengers)
        ? (merged.yearlyPassengers as YearlyPassengers)
        : null
    )
    setPreparedAdditionalDetails(null)
  }, [station, pendingEntry])

  useEffect(() => {
    let cancelled = false
    setAdditionalLoading(true)
    setAdditionalDoc(null)
    fetchStationDocumentById(station.id, stationCollectionId)
      .then((data) => {
        if (!cancelled && data) {
          const doc = data as SandboxStationDoc
          setAdditionalDoc(doc)
          const mergedDoc = mergeAdditionalDocWithPendingUpdate(doc, pendingEntry)
          const picked = pickAdditionalDetails(mergedDoc ?? doc, stationCollectionId)
          setAdditionalForm(picked)
          const facilities =
            picked.facilities && typeof picked.facilities === 'object' && !Array.isArray(picked.facilities)
              ? (picked.facilities as Record<string, unknown>)
              : {}
          const rows = Object.entries(facilities).map(([k, v]) => ({ key: k, value: v == null ? '' : String(v) }))
          setFacilitiesRows(rows.length > 0 ? rows : [])
        }
      })
      .finally(() => {
        if (!cancelled) setAdditionalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [collectionId, station.id, stationCollectionId, pendingEntry])

  useEffect(() => {
    if (fieldSchema.facilityKeys.length === 0) return
    setFacilitiesRows((prev) => {
      const map = new Map(prev.map((r) => [r.key, r.value]))
      const keys = [...new Set([...fieldSchema.facilityKeys, ...prev.map((r) => r.key)])]
      return keys.map((key) => ({ key, value: map.get(key) ?? '' }))
    })
  }, [fieldSchema.facilityKeys, additionalDoc])

  const update = (updates: Partial<Station>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  const validateAndPrepareYearlyPassengers = (): YearlyPassengers | null | 'error' => {
    setSaveError(null)
    if (yearlyPassengersRows.length === 0) return null

    const out: YearlyPassengers = {}
    const seen = new Set<string>()

    for (const row of yearlyPassengersRows) {
      const year = row.year.trim()
      if (!year) continue
      if (!/^\d{4}$/.test(year)) {
        setSaveError('Year must be a 4-digit year (e.g. 2021)')
        return 'error'
      }
      if (seen.has(year)) {
        setSaveError(`Duplicate year: ${year}`)
        return 'error'
      }
      seen.add(year)

      const raw = row.value.trim()
      if (raw === '') {
        out[year] = null
        continue
      }
      const num = Number(raw.replace(/,/g, ''))
      if (Number.isNaN(num)) {
        setSaveError(`Passenger value for ${year} must be a number`)
        return 'error'
      }
      out[year] = num
    }
    return Object.keys(out).length > 0 ? out : null
  }

  const validateAndPrepareAdditionalDetails = (): Partial<SandboxStationDoc> | null | 'error' => {
    setSaveError(null)
    if (fieldSchema.isLightRail) {
      const picked = pickChangedLightRailSandboxFields(
        additionalForm as Record<string, unknown>,
        additionalDoc as Record<string, unknown> | null
      )
      return Object.keys(picked).length > 0 ? (picked as Partial<SandboxStationDoc>) : null
    }
    const picked = pickAdditionalDetails(additionalForm as SandboxStationDoc, stationCollectionId)

    const facilities: Record<string, unknown> = {}
    for (const row of facilitiesRows) {
      const k = row.key.trim()
      if (!k) continue
      const raw = row.value.trim()
      if (raw === '') {
        // Preserve existing facility keys as explicit nulls so "no change" doesn't
        // look like a diff just because blank inputs were omitted.
        facilities[k] = null
        continue
      }
      if (raw === 'true') facilities[k] = true
      else if (raw === 'false') facilities[k] = false
      else if (!Number.isNaN(Number(raw)) && raw !== '') facilities[k] = Number(raw)
      else facilities[k] = raw
    }
    if (Object.keys(facilities).length > 0) {
      picked.facilities = facilities
    } else {
      delete picked.facilities
    }
    if (fieldSchema.showUrl) {
      Object.assign(picked, writeStationUrlPayload(stationCollectionId, readEditedStationUrl(additionalForm, additionalDoc, urlFieldKey)))
    }
    return Object.keys(picked).length > 0 ? picked : null
  }

  const updateAdditional = (updates: Partial<SandboxStationDoc>) => {
    setAdditionalForm((prev) => ({ ...prev, ...updates }))
  }

  const updateAdditionalNested = <K extends keyof SandboxStationDoc>(key: K, nested: Record<string, unknown>) => {
    setAdditionalForm((prev) => ({
      ...prev,
      [key]: { ...(typeof prev[key] === 'object' && prev[key] !== null ? (prev[key] as object) : {}), ...nested }
    }))
  }

  const hasDetectedChanges = (): boolean => {
    const normStr = (v: unknown) => String(v ?? '').trim()
    const normOpt = (v: unknown) => {
      const s = normStr(v)
      return s === '' ? null : s
    }

    const currentStation = {
      stationName: normOpt(station.stationName),
      crsCode: normOpt(station.crsCode),
      tiploc: normOpt(station.tiploc),
      toc: normOpt(station.toc),
      country: normOpt(station.country),
      county: normOpt(station.county),
      stnarea: normOpt(station.stnarea),
      borough: normOpt(station.borough),
      fareZone: normOpt(station.fareZone),
      latitude: Number(station.latitude ?? 0),
      longitude: Number(station.longitude ?? 0)
    }

    const draftStation = {
      stationName: normOpt(form.stationName),
      crsCode: normOpt(form.crsCode),
      tiploc: normOpt(form.tiploc),
      toc: normOpt(form.toc),
      country: normOpt(form.country),
      county: normOpt(form.county),
      stnarea: normOpt(form.stnarea),
      borough: normOpt(form.borough),
      fareZone: normOpt(form.fareZone),
      latitude: Number(toNumberOrString(form.latitude) || 0),
      longitude: Number(toNumberOrString(form.longitude) || 0)
    }

    if (stableStringify(currentStation) !== stableStringify(draftStation)) return true

    // Yearly passengers: compare the object as stored, not the raw rows UI.
    const currentPassengers =
      station.yearlyPassengers && typeof station.yearlyPassengers === 'object' && !Array.isArray(station.yearlyPassengers)
        ? (station.yearlyPassengers as Record<string, unknown>)
        : null
    const draftPassengers = (() => {
      if (yearlyPassengersRows.length === 0) return null
      const out: Record<string, unknown> = {}
      for (const row of yearlyPassengersRows) {
        const year = String(row.year ?? '').trim()
        if (!year) continue
        const raw = String(row.value ?? '').trim()
        if (raw === '') out[year] = null
        else out[year] = toNumberOrString(raw)
      }
      return Object.keys(out).length > 0 ? out : null
    })()
    if (stableStringify(currentPassengers) !== stableStringify(draftPassengers)) return true

    // Additional details: compare a draft built the same way review/save do.
    const draftAdditional = (() => {
      if (fieldSchema.isLightRail) {
        const picked = pickChangedLightRailSandboxFields(
          additionalForm as Record<string, unknown>,
          additionalDoc as Record<string, unknown> | null
        )
        return Object.keys(picked).length > 0 ? picked : null
      }
      const picked = pickAdditionalDetails(additionalForm as SandboxStationDoc, stationCollectionId)
      const facilities: Record<string, unknown> = {}
      for (const row of facilitiesRows) {
        const k = row.key.trim()
        if (!k) continue
        const raw = row.value.trim()
        if (raw === '') {
          facilities[k] = null
          continue
        }
        if (raw === 'true') facilities[k] = true
        else if (raw === 'false') facilities[k] = false
        else if (!Number.isNaN(Number(raw)) && raw !== '') facilities[k] = Number(raw)
        else facilities[k] = raw
      }
      if (Object.keys(facilities).length > 0) picked.facilities = facilities
      else delete picked.facilities
      if (fieldSchema.showUrl) {
        Object.assign(picked, writeStationUrlPayload(stationCollectionId, readEditedStationUrl(additionalForm, additionalDoc, urlFieldKey)))
      }
      return Object.keys(picked).length > 0 ? picked : null
    })()

    const currentAdditional = fieldSchema.isLightRail
      ? pickLightRailSandboxOnlyFields(additionalDoc as Record<string, unknown>)
      : pickAdditionalDetails(additionalDoc, stationCollectionId)
    if (stableStringify(currentAdditional) !== stableStringify(draftAdditional)) return true

    return false
  }

  useEffect(() => {
    onUnsavedChangesChange?.(hasDetectedChanges())
  }, [form, additionalForm, yearlyPassengersRows, facilitiesRows, station, additionalDoc, onUnsavedChangesChange])

  const handleBeginReview = () => {
    if (!hasDetectedChanges()) {
      setSaveError('No changes to save.')
      return
    }
    const result = validateAndPrepareYearlyPassengers()
    if (result === 'error') return
    setPreparedYearlyPassengers(result as YearlyPassengers | null)
    const addl = validateAndPrepareAdditionalDetails()
    if (addl === 'error') return
    setPreparedAdditionalDetails(addl as Partial<SandboxStationDoc> | null)
    setIsReviewing(true)
  }

  const handlePublish = async () => {
    const yearlyPassengers =
      preparedYearlyPassengers !== null ? preparedYearlyPassengers : validateAndPrepareYearlyPassengers()
    if (yearlyPassengers === 'error') {
      setIsReviewing(false)
      return
    }
    const additionalDetails =
      preparedAdditionalDetails !== null ? preparedAdditionalDetails : validateAndPrepareAdditionalDetails()
    if (additionalDetails === 'error') {
      setIsReviewing(false)
      return
    }

    setSaving(true)
    try {
      const requiredMissing: string[] = []
      const stationName = String(form.stationName ?? '').trim()
      const crsCode = String(form.crsCode ?? '').trim()
      const tiploc = String(form.tiploc ?? '').trim()
      const toc = String(form.toc ?? '').trim()
      const country = String(form.country ?? '').trim()
      const county = String(form.county ?? '').trim()
      const stnarea = String(form.stnarea ?? '').trim()
      const latRaw = String(form.latitude ?? '').trim()
      const lngRaw = String(form.longitude ?? '').trim()
      const urlValue = readEditedStationUrl(additionalForm, additionalDoc, urlFieldKey)

      if (!stationName) requiredMissing.push('Station name')
      if (fieldSchema.requireCrsCode && !crsCode) requiredMissing.push('CRS Code')
      if (fieldSchema.requireTiploc && !tiploc) requiredMissing.push('Tiploc')
      if (!fieldSchema.isLightRail && !toc) requiredMissing.push('TOC')
      if (!country) requiredMissing.push('Country')
      if (!county) requiredMissing.push('County')
      if (!stnarea) requiredMissing.push('Station area')
      if (!latRaw) requiredMissing.push('Latitude')
      if (!lngRaw) requiredMissing.push('Longitude')
      if (fieldSchema.showUrl && !urlValue) requiredMissing.push(urlFieldLabel)

      if (requiredMissing.length > 0) {
        setSaveError(`Missing required fields: ${requiredMissing.join(', ')}.`)
        setSaving(false)
        return
      }

      const lat = typeof form.latitude === 'number' ? form.latitude : parseFloat(String(form.latitude)) || 0
      const lng = typeof form.longitude === 'number' ? form.longitude : parseFloat(String(form.longitude)) || 0

      const finalSandboxUpdated = {
        ...(additionalDetails as Partial<SandboxStationDoc> | null),
        ...writeStationUrlPayload(stationCollectionId, urlValue),
      }

      upsertPendingChange(
        station,
        fieldSchema.isLightRail
          ? {
              stationName,
              latitude: lat,
              longitude: lng,
              country: country || null,
              county: county || null,
              stnarea: stnarea || null,
              borough: form.borough || null,
              fareZone: form.fareZone || null,
            }
          : {
              stationName,
              crsCode: crsCode || '',
              tiploc: tiploc || null,
              latitude: lat,
              longitude: lng,
              country: country || null,
              county: county || null,
              toc: toc || null,
              stnarea: stnarea || null,
              borough: form.borough || null,
              fareZone: form.fareZone || null,
              yearlyPassengers,
            },
        stationCollectionId,
        Object.keys(finalSandboxUpdated).length > 0 ? finalSandboxUpdated : null,
        pickAdditionalDetails(additionalDoc, stationCollectionId)
      )
      onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const reviewUpdatedAdditional = isReviewing
    ? {
        ...(preparedAdditionalDetails ?? pickAdditionalDetails(additionalForm as SandboxStationDoc)),
        ...writeStationUrlPayload(
          stationCollectionId,
          readEditedStationUrl(additionalForm, additionalDoc, urlFieldKey)
        ),
      }
    : null

  const changes = isReviewing
    ? getStationFieldChanges({
        originalStation: station,
        updatedStation: {
          stationName: form.stationName ?? '',
          crsCode: form.crsCode ?? '',
          tiploc: form.tiploc ?? null,
          latitude: form.latitude ?? station.latitude,
          longitude: form.longitude ?? station.longitude,
          country: form.country ?? null,
          county: form.county ?? null,
          toc: form.toc ?? null,
          stnarea: form.stnarea ?? null,
          borough: form.borough ?? null,
          fareZone: form.fareZone ?? null,
          yearlyPassengers: preparedYearlyPassengers,
        },
        originalAdditional: pickAdditionalDetails(additionalDoc),
        updatedAdditional: reviewUpdatedAdditional,
      })
    : []

  return (
    <div className="modal-body">
      {pendingEntry && !isReviewing && (
        <StationPendingChangesBanner
          changes={getPendingFieldChangesForEntry(pendingEntry, { additionalDocFallback: additionalDoc })}
          isNew={pendingEntry.isNew === true}
        />
      )}
      {!isReviewing ? (
        <>
          {showDetails && (
        <>
        <div className="modal-section">
          <h3 className="modal-section-title">Details</h3>
          <div className="modal-detail-item edit-readonly">
            <span className="modal-detail-label">Station ID</span>
            <span className="modal-detail-value">{station.id}</span>
          </div>

          <p className="edit-hint">Required fields are marked *</p>

          <div className="edit-form-grid">
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-stationName">
                {fieldSchema.isLightRail ? 'Stop name *' : 'Station name *'}
              </label>
              <TXTINPWideButton
                id="edit-stationName"
                value={form.stationName ?? ''}
                onInputChange={(e) => update({ stationName: e.target.value })}
                inputClassName="edit-input"
              
                colorVariant="secondary"
              />
            </div>
            {!fieldSchema.isLightRail && (
              <>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-crsCode">
                CRS Code{fieldSchema.requireCrsCode ? ' *' : ''}
              </label>
              <TXTINPWideButton
                id="edit-crsCode"
                value={form.crsCode ?? ''}
                onInputChange={(e) => update({ crsCode: e.target.value })}
                inputClassName="edit-input"
              
                colorVariant="secondary"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-tiploc">
                Tiploc{fieldSchema.requireTiploc ? ' *' : ''}
              </label>
              <TXTINPWideButton
                id="edit-tiploc"
                value={form.tiploc ?? ''}
                onInputChange={(e) => update({ tiploc: e.target.value })}
                inputClassName="edit-input"
              
                colorVariant="secondary"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-toc">
                TOC *
              </label>
              <TXTINPWideButton
                id="edit-toc"
                value={form.toc ?? ''}
                onInputChange={(e) => update({ toc: e.target.value })}
                inputClassName="edit-input"
              
                colorVariant="secondary"
              />
            </div>
              </>
            )}
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-country">
                Country *
              </label>
              <TXTINPWideButton
                id="edit-country"
                value={form.country ?? ''}
                onInputChange={(e) => update({ country: e.target.value })}
                inputClassName="edit-input"
              
                colorVariant="secondary"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-county">
                County *
              </label>
              <TXTINPWideButton
                id="edit-county"
                value={form.county ?? ''}
                onInputChange={(e) => update({ county: e.target.value })}
                inputClassName="edit-input"
              
                colorVariant="secondary"
              />
            </div>
            <div className="edit-field">
              <label className="edit-label" htmlFor="edit-stnarea">
                Station area *
              </label>
              <TXTINPWideButton
                id="edit-stnarea"
                value={form.stnarea ?? ''}
                onInputChange={(e) => update({ stnarea: e.target.value })}
                inputClassName="edit-input"
              
                colorVariant="secondary"
              />
            </div>
            {fieldSchema.showBorough && (
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-borough">
                  Borough
                </label>
                <TXTINPWideButton
                  id="edit-borough"
                  value={form.borough ?? ''}
                  onInputChange={(e) => update({ borough: e.target.value })}
                  inputClassName="edit-input"
                  colorVariant="secondary"
                />
              </div>
            )}
            {fieldSchema.showFareZone && (
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-fareZone">
                  Fare Zone
                </label>
                <TXTINPWideButton
                  id="edit-fareZone"
                  value={form.fareZone ?? ''}
                  onInputChange={(e) => update({ fareZone: e.target.value })}
                  inputClassName="edit-input"
                  colorVariant="secondary"
                />
              </div>
            )}
            {fieldSchema.showLinesServed && (
              <div className="edit-field edit-field-full">
                <span className="edit-label" id="edit-linesServed-label">
                  Lines served
                </span>
                <LightRailLinesServedChipPicker
                  id="edit-linesServed"
                  labelledBy="edit-linesServed-label"
                  value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.linesServed)}
                  onChange={(next) =>
                    updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.linesServed]: next } as Partial<SandboxStationDoc>)
                  }
                />
              </div>
            )}
            {fieldSchema.showPlatforms && (
              <div className="edit-field edit-field-full">
                <span className="edit-label" id="edit-platforms-label">
                  Platforms
                </span>
                <LightRailPlatformsChipPicker
                  id="edit-platforms"
                  labelledBy="edit-platforms-label"
                  value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.platforms)}
                  onChange={(next) =>
                    updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.platforms]: next } as Partial<SandboxStationDoc>)
                  }
                />
              </div>
            )}
            {fieldSchema.showNlc && (
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-nlc">
                  NLC
                </label>
                <TXTINPWideButton
                  id="edit-nlc"
                  value={String(additionalForm.nlc ?? '')}
                  onInputChange={(e) => updateAdditional({ nlc: e.target.value })}
                  inputClassName="edit-input"
                  colorVariant="secondary"
                />
              </div>
            )}
            {fieldSchema.showGauge && (
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-gauge">
                  Gauge
                </label>
                <TXTINPWideButton
                  id="edit-gauge"
                  value={String(additionalForm.guage ?? '')}
                  onInputChange={(e) => updateAdditional({ guage: e.target.value })}
                  inputClassName="edit-input"
                  colorVariant="secondary"
                />
              </div>
            )}
            {fieldSchema.showUrl && (
              <div className="edit-field edit-field-full">
                <label className="edit-label" htmlFor="edit-station-url">
                  {urlFieldLabel} *
                </label>
                <TXTINPWideButton
                  id="edit-station-url"
                  value={String(additionalForm[urlFieldKey] ?? readStationUrl(additionalDoc))}
                  onInputChange={(e) =>
                    updateAdditional({ [urlFieldKey]: e.target.value } as Partial<SandboxStationDoc>)
                  }
                  inputClassName="edit-input"
                  colorVariant="secondary"
                />
              </div>
            )}
          </div>
        </div>

        {fieldSchema.showStepFreeSection && (
          <div className="modal-section">
            <h3 className="modal-section-title">{STEP_FREE_SECTION_LABEL}</h3>
            <div className="edit-form-grid">
              <div className="edit-field">
                <label className="edit-label" htmlFor="edit-stepFreeCode">
                  Step Free Status
                </label>
                {fieldSchema.isLightRail ? (
                  <LightRailYesNoSelect
                    id="edit-stepFreeCode"
                    value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.isStepFree)}
                    onChange={(nextValue) =>
                      updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.isStepFree]: nextValue } as Partial<SandboxStationDoc>)
                    }
                  />
                ) : (
                  <TXTINPWideButton
                    id="edit-stepFreeCode"
                    value={String(additionalForm.stepFree?.stepFreeCode ?? '')}
                    onInputChange={(e) => updateAdditionalNested('stepFree', { stepFreeCode: e.target.value })}
                    inputClassName="edit-input"
                    colorVariant="secondary"
                  />
                )}
              </div>
              {fieldSchema.showStepFreeNote && (
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="edit-stepFreeNote">
                    Note
                  </label>
                  <TXTINPWideButton
                    id="edit-stepFreeNote"
                    value={String(additionalForm.stepFree?.stepFreeNote ?? '')}
                    onInputChange={(e) => updateAdditionalNested('stepFree', { stepFreeNote: e.target.value })}
                    inputClassName="edit-input"
                    colorVariant="secondary"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        </>
          )}

          {showLocationTab && (
            <div className="modal-section">
              <h3 className="modal-section-title">Location</h3>
              <LocationMapPicker
                latitude={Number(form.latitude ?? 0)}
                longitude={Number(form.longitude ?? 0)}
                onLatLngChange={(lat, lng) => update({ latitude: lat, longitude: lng })}
                height={480}
              />
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-latitude">
                    Latitude *
                  </label>
                  <input
                    id="edit-latitude"
                    type="number"
                    step="any"
                    value={form.latitude ?? ''}
                    onChange={(e) => update({ latitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="edit-input"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-longitude">
                    Longitude *
                  </label>
                  <input
                    id="edit-longitude"
                    type="number"
                    step="any"
                    value={form.longitude ?? ''}
                    onChange={(e) => update({ longitude: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                    className="edit-input"
                  />
                </div>
              </div>
            </div>
          )}

          {showUsage && (
          <div className="modal-section">
            <h3 className="modal-section-title">Usage</h3>
            {yearlyPassengersRows.length === 0 && <p className="edit-hint">No yearly passenger rows set.</p>}
            {yearlyPassengersRows.map((row, idx) => (
              <div key={`${idx}-${row.year}`} className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor={`edit-year-${idx}`}>
                    Year
                  </label>
                  <TXTINPWideButton
                    id={`edit-year-${idx}`}
                    value={row.year}
                    onInputChange={(e) => {
                      const v = e.target.value
                      setYearlyPassengersRows((prev) => prev.map((r, i) => (i === idx ? { ...r, year: v } : r)))
                    }}
                    inputClassName="edit-input"
                    placeholder="e.g. 2021"
                  
                colorVariant="secondary"
              />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor={`edit-passengers-${idx}`}>
                    Passengers
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <TXTINPWideButton
                      id={`edit-passengers-${idx}`}
                      value={row.value}
                      onInputChange={(e) => {
                        const v = e.target.value
                        setYearlyPassengersRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: v } : r)))
                      }}
                      inputClassName="edit-input"
                      placeholder="e.g. 123456"
                      style={{ flex: 1 }}
                    
                colorVariant="secondary"
              />
                    <Button
                      type="button"
                      variant="circle"
                      ariaLabel="Remove yearly passenger row"
                      onClick={() => setYearlyPassengersRows((prev) => prev.filter((_, i) => i !== idx))}
                      icon={
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="wide" width="hug" onClick={() => setYearlyPassengersRows((prev) => [...prev, { year: '', value: '' }])}>
              + Add year
            </Button>
          </div>
          )}

          {showAdditional && (
          <div className="modal-section">
            <h3 className="modal-section-title">Additional details</h3>
            {additionalLoading && <p className="modal-sandbox-loading">Loading additional details…</p>}

            <div className="edit-form-grid">
              {fieldSchema.showOperatorCode && (
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-operatorCode">
                    Operator Code
                  </label>
                  <TXTINPWideButton
                    id="edit-operatorCode"
                    value={String(additionalForm.operatorCode ?? '')}
                    onInputChange={(e) => updateAdditional({ operatorCode: e.target.value })}
                    inputClassName="edit-input"
                    colorVariant="secondary"
                  />
                </div>
              )}
              {fieldSchema.showMinConnectionTime && (
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-minConnectionTime">
                    Min connection time
                  </label>
                  <TXTINPWideButton
                    id="edit-minConnectionTime"
                    value={String((additionalForm['min-connection-time'] as unknown) ?? '')}
                    onInputChange={(e) => updateAdditional({ 'min-connection-time': e.target.value })}
                    inputClassName="edit-input"
                    colorVariant="secondary"
                  />
                </div>
              )}
              {fieldSchema.showProvince && (
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-province">
                    Province
                  </label>
                  <TXTINPWideButton
                    id="edit-province"
                    value={String(additionalForm.province ?? '')}
                    onInputChange={(e) => updateAdditional({ province: e.target.value })}
                    inputClassName="edit-input"
                    colorVariant="secondary"
                  />
                </div>
              )}
              {fieldSchema.showPostEirCode && (
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-post-eir-code">
                    Post / Eircode
                  </label>
                  <TXTINPWideButton
                    id="edit-post-eir-code"
                    value={String(additionalForm['post-eir_code'] ?? '')}
                    onInputChange={(e) => updateAdditional({ 'post-eir_code': e.target.value })}
                    inputClassName="edit-input"
                    colorVariant="secondary"
                  />
                </div>
              )}
            </div>

          </div>
          )}

          {showFacilities && fieldSchema.showToiletsSection && (
            <div className="modal-section">
              <h3 className="modal-section-title">Toilets</h3>
              <div className="edit-form-grid">
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-toiletsAccessible">
                    Accessible
                  </label>
                  <TXTINPWideButton
                    id="edit-toiletsAccessible"
                    value={String(additionalForm.toilets?.toiletsAccessible ?? '')}
                    onInputChange={(e) => updateAdditionalNested('toilets', { toiletsAccessible: e.target.value })}
                    inputClassName="edit-input"
                  
                colorVariant="secondary"
              />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-toiletsChangingPlace">
                    Changing Place
                  </label>
                  <TXTINPWideButton
                    id="edit-toiletsChangingPlace"
                    value={String(additionalForm.toilets?.toiletsChangingPlace ?? '')}
                    onInputChange={(e) => updateAdditionalNested('toilets', { toiletsChangingPlace: e.target.value })}
                    inputClassName="edit-input"
                  
                colorVariant="secondary"
              />
                </div>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-toiletsBabyChanging">
                    Baby changing
                  </label>
                  <TXTINPWideButton
                    id="edit-toiletsBabyChanging"
                    value={String(additionalForm.toilets?.toiletsBabyChanging ?? '')}
                    onInputChange={(e) => updateAdditionalNested('toilets', { toiletsBabyChanging: e.target.value })}
                    inputClassName="edit-input"
                  
                colorVariant="secondary"
              />
                </div>
              </div>
            </div>
          )}

          {showStepFree && fieldSchema.showLiftSection && (
            <div className="modal-section">
              <h3 className="modal-section-title">Lift</h3>
              <div className="edit-form-grid">
                {fieldSchema.isLightRail ? (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-hasLift">
                      Has lift
                    </label>
                    <LightRailYesNoSelect
                      id="edit-hasLift"
                      value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.hasLift)}
                      onChange={(nextValue) =>
                        updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.hasLift]: nextValue } as Partial<SandboxStationDoc>)
                      }
                    />
                  </div>
                ) : (
                  <>
                <div className="edit-field">
                  <label className="edit-label" htmlFor="edit-liftAvailable">
                    Available
                  </label>
                  <TXTINPWideButton
                    id="edit-liftAvailable"
                    value={String(additionalForm.lift?.liftAvailable ?? '')}
                    onInputChange={(e) => updateAdditionalNested('lift', { liftAvailable: e.target.value })}
                    inputClassName="edit-input"
                  
                colorVariant="secondary"
              />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="edit-liftNotes">
                    Notes
                  </label>
                  <TXTINPWideButton
                    id="edit-liftNotes"
                    value={String(additionalForm.lift?.liftNotes ?? '')}
                    onInputChange={(e) => updateAdditionalNested('lift', { liftNotes: e.target.value })}
                    inputClassName="edit-input"
                  
                colorVariant="secondary"
              />
                </div>
                <div className="edit-field edit-field-full">
                  <label className="edit-label" htmlFor="edit-liftDetails">
                    Details
                  </label>
                  <TXTINPWideButton
                    id="edit-liftDetails"
                    value={String(additionalForm.lift?.liftDetails ?? '')}
                    onInputChange={(e) => updateAdditionalNested('lift', { liftDetails: e.target.value })}
                    inputClassName="edit-input"
                  
                colorVariant="secondary"
              />
                </div>
                  </>
                )}
              </div>
            </div>
          )}

          {showService && (
            <div className="modal-section">
              <h3 className="modal-section-title">Service & Connections</h3>
              <div className="edit-form-grid">
                {fieldSchema.isLightRail && fieldSchema.showDateOpened && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-dateOpened">
                      Date opened
                    </label>
                    <LightRailDateOpenedInput
                      id="edit-dateOpened"
                      value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.dateOpened)}
                      onChange={(nextValue) =>
                        updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.dateOpened]: nextValue } as Partial<SandboxStationDoc>)
                      }
                    />
                  </div>
                )}
                {!fieldSchema.isLightRail && fieldSchema.showConnectionBus && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-connectionBus">
                      Bus
                    </label>
                    <TXTINPWideButton
                      id="edit-connectionBus"
                      value={String(additionalForm.connections?.connectionBus ?? '')}
                      onInputChange={(e) => updateAdditionalNested('connections', { connectionBus: e.target.value })}
                      inputClassName="edit-input"
                      colorVariant="secondary"
                    />
                  </div>
                )}
                {fieldSchema.isLightRail && fieldSchema.showConnectionBus && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-bus">
                      Bus
                    </label>
                    <LightRailYesNoSelect
                      id="edit-bus"
                      value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.bus)}
                      onChange={(nextValue) =>
                        updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.bus]: nextValue } as Partial<SandboxStationDoc>)
                      }
                    />
                  </div>
                )}
                {fieldSchema.isLightRail && fieldSchema.showConnectionTrain && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-train">
                      Train
                    </label>
                    <LightRailYesNoSelect
                      id="edit-train"
                      value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.train)}
                      onChange={(nextValue) =>
                        updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.train]: nextValue } as Partial<SandboxStationDoc>)
                      }
                    />
                  </div>
                )}
                {!fieldSchema.isLightRail && fieldSchema.showConnectionTaxi && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-connectionTaxi">
                      Taxi
                    </label>
                    <TXTINPWideButton
                      id="edit-connectionTaxi"
                      value={String(additionalForm.connections?.connectionTaxi ?? '')}
                      onInputChange={(e) => updateAdditionalNested('connections', { connectionTaxi: e.target.value })}
                      inputClassName="edit-input"
                      colorVariant="secondary"
                    />
                  </div>
                )}
                {!fieldSchema.isLightRail && fieldSchema.showConnectionUnderground && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-connectionUnderground">
                      Underground
                    </label>
                    <TXTINPWideButton
                      id="edit-connectionUnderground"
                      value={String(additionalForm.connections?.connectionUnderground ?? '')}
                      onInputChange={(e) => updateAdditionalNested('connections', { connectionUnderground: e.target.value })}
                      inputClassName="edit-input"
                      colorVariant="secondary"
                    />
                  </div>
                )}
                {!fieldSchema.isLightRail && fieldSchema.showStationStatusSection && (
                  <>
                    <div className="edit-field">
                      <label className="edit-label" htmlFor="edit-station-status">
                        Status
                      </label>
                      <TXTINPWideButton
                        id="edit-station-status"
                        value={String(additionalForm.stationstatus?.status ?? '')}
                        onInputChange={(e) => updateAdditionalNested('stationstatus', { status: e.target.value })}
                        inputClassName="edit-input"
                        colorVariant="secondary"
                      />
                    </div>
                    <div className="edit-field">
                      <label className="edit-label" htmlFor="edit-operational-period">
                        Operational period
                      </label>
                      <TXTINPWideButton
                        id="edit-operational-period"
                        value={String(additionalForm.stationstatus?.operationalperiod ?? '')}
                        onInputChange={(e) =>
                          updateAdditionalNested('stationstatus', { operationalperiod: e.target.value })
                        }
                        inputClassName="edit-input"
                        colorVariant="secondary"
                      />
                    </div>
                  </>
                )}
                {fieldSchema.showStaffingLevel && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-staffingLevel">
                      {fieldSchema.isLightRail ? 'Staffed' : 'Staffing Level'}
                    </label>
                    {fieldSchema.isLightRail ? (
                      <LightRailYesNoSelect
                        id="edit-staffingLevel"
                        value={readLightRailDocString(additionalForm as Record<string, unknown>, LIGHT_RAIL_DOC_FIELDS.isStaffed)}
                        onChange={(nextValue) =>
                          updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.isStaffed]: nextValue } as Partial<SandboxStationDoc>)
                        }
                      />
                    ) : (
                      <TXTINPWideButton
                        id="edit-staffingLevel"
                        value={String(additionalForm.staffingLevel ?? '')}
                        onInputChange={(e) => updateAdditional({ staffingLevel: e.target.value })}
                        inputClassName="edit-input"
                        colorVariant="secondary"
                      />
                    )}
                  </div>
                )}
                {!fieldSchema.isLightRail && fieldSchema.showRequestStop && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-requestStop">
                      Request stop
                    </label>
                    <TXTINPWideButton
                      id="edit-requestStop"
                      value={String(additionalForm.is?.isrequeststop ?? '')}
                      onInputChange={(e) => updateAdditionalNested('is', { isrequeststop: e.target.value })}
                      inputClassName="edit-input"
                      colorVariant="secondary"
                    />
                  </div>
                )}
                {fieldSchema.showLimitedService && (
                  <div className="edit-field">
                    <label className="edit-label" htmlFor="edit-limitedService">
                      Limited service
                    </label>
                    {fieldSchema.isLightRail ? (
                      <LightRailYesNoSelect
                        id="edit-limitedService"
                        value={readLightRailDocString(
                          additionalForm as Record<string, unknown>,
                          LIGHT_RAIL_DOC_FIELDS.isLimitedService
                        )}
                        onChange={(nextValue) =>
                          updateAdditional({ [LIGHT_RAIL_DOC_FIELDS.isLimitedService]: nextValue } as Partial<SandboxStationDoc>)
                        }
                      />
                    ) : (
                      <TXTINPWideButton
                        id="edit-limitedService"
                        value={String(additionalForm.is?.Islimitedservice ?? '')}
                        onInputChange={(e) => updateAdditionalNested('is', { Islimitedservice: e.target.value })}
                        inputClassName="edit-input"
                        colorVariant="secondary"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showFacilities && fieldSchema.facilityKeys.length > 0 && (
            <div className="modal-section">
              <h3 className="modal-section-title">Facilities</h3>
              {facilitiesRows.length === 0 && <p className="edit-hint">No facilities set for this station.</p>}
              {facilitiesRows.length > 0 && (
                <div className="edit-form-grid">
                  {facilitiesRows.map((row, idx) => {
                    const label = row.key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/[_-]+/g, ' ')
                      .replace(/^./, (s) => s.toUpperCase())
                    return (
                      <div key={`${idx}-${row.key}`} className="edit-field">
                        <label className="edit-label" htmlFor={`edit-facility-${idx}`}>
                          {label}
                        </label>
                        <TXTINPWideButton
                          id={`edit-facility-${idx}`}
                          value={row.value}
                          onInputChange={(e) => {
                            const v = e.target.value
                            setFacilitiesRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: v } : r)))
                          }}
                          inputClassName="edit-input"
                          placeholder="—"
                        
                colorVariant="secondary"
              />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="modal-section edit-review-section">
          <div className="edit-review-header">
            <h3 className="edit-review-title">Review changes before publishing</h3>
            <p className="edit-review-subtitle">These changes will be published to the currently selected data source.</p>
          </div>
          {changes.length === 0 ? (
            <p className="edit-review-empty">No changes detected compared to the current database values.</p>
          ) : (
            <ul className="edit-review-list">
              {changes.map((change) => (
                <li key={change.label} className="edit-review-item">
                  <div className="edit-review-label">{change.label}</div>
                  <div className="edit-review-values">
                    <span className="edit-review-from">{change.from}</span>
                    <span className="edit-review-arrow">→</span>
                    <span className="edit-review-to">{change.to}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {saveError && (
        <div className="edit-error" role="alert">
          {saveError}
        </div>
      )}

      {(() => {
        const actions = (
          <div className="modal-edit-actions modal-edit-actions--inline">
            <Button
              type="button"
              variant="wide"
              width="hug"
              className="edit-cancel-button"
              onClick={() => {
                if (isReviewing) {
                  setIsReviewing(false)
                  return
                }
                if (hasDetectedChanges() && !window.confirm(UNSAVED_MESSAGE)) return
                onCancel()
              }}
            >
              {isReviewing ? 'Back to editing' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="wide"
              width="hug"
              className="edit-save-button"
              onClick={() => (isReviewing ? handlePublish() : handleBeginReview())}
              disabled={saving || (!isReviewing && !hasDetectedChanges())}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )

        const portalEl =
          actionsPortalId && typeof document !== 'undefined' ? document.getElementById(actionsPortalId) : null
        return portalEl ? createPortal(actions, portalEl) : actions
      })()}
    </div>
  )
}

export default StationDetailsEditForm

