import { useEffect, useState } from 'react'
import type { StationCollectionId } from '../constants/stationCollections'
import { isNetworkCollection, isStationCollectionId, NETWORK_STNAREA_DEFAULTS } from '../constants/stationCollections'
import type { Station } from '../types'
import { fetchStationCollectionSampleDocs } from '../services/firebase'
import {
  EMPTY_STATION_COLLECTION_FIELD_SCHEMA,
  inferStationCollectionFieldSchema,
  type StationCollectionFieldSchema,
} from '../utils/stationCollectionFieldSchema'
import { getStationUrlFieldKey, getStationUrlFieldLabel } from '../utils/stationUrlField'
import { useStationCollection } from '../contexts/StationCollectionContext'

export function useStationCollectionFieldSchema(collectionId: StationCollectionId | null): {
  fieldSchema: StationCollectionFieldSchema
  loading: boolean
} {
  const [fieldSchema, setFieldSchema] = useState<StationCollectionFieldSchema>(EMPTY_STATION_COLLECTION_FIELD_SCHEMA)
  const [loading, setLoading] = useState(Boolean(collectionId))

  useEffect(() => {
    if (!collectionId) {
      setFieldSchema(EMPTY_STATION_COLLECTION_FIELD_SCHEMA)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void fetchStationCollectionSampleDocs(collectionId)
      .then((docs) => {
        if (!cancelled) {
          setFieldSchema(inferStationCollectionFieldSchema(docs, collectionId))
        }
      })
      .catch(() => {
        if (!cancelled) {
          const networkId = isNetworkCollection(collectionId) ? collectionId : undefined
          setFieldSchema({
            ...EMPTY_STATION_COLLECTION_FIELD_SCHEMA,
            defaultStnarea: networkId ? NETWORK_STNAREA_DEFAULTS[networkId] : '',
            showUrl: collectionId === 'stations_gbheritage',
            urlFieldKey: getStationUrlFieldKey(collectionId),
            urlFieldLabel: getStationUrlFieldLabel(collectionId),
            requireCrsCode: collectionId !== 'stations_gbheritage',
            requireTiploc: collectionId !== 'stations_gbheritage',
            showStepFreeSection: collectionId === 'stations_gbheritage',
            showStepFreeTab: false,
            stepFreeTabLabel: 'Step-free & Lift access',
            showStationStatusSection: collectionId === 'stations_gbheritage',
            showStaffingLevel: collectionId === 'stations_gbheritage',
            showNlc: collectionId === 'stations_gbheritage',
            showGauge: collectionId === 'stations_gbheritage',
            showRequestStop: collectionId === 'stations_gbheritage',
            showServiceTab: collectionId === 'stations_gbheritage',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [collectionId])

  return { fieldSchema, loading }
}

/** Resolve field schema for a station, optionally reusing a schema fetched by the parent. */
export function useStationFieldSchema(
  station: Station,
  fieldSchemaOverride?: StationCollectionFieldSchema
): { fieldSchema: StationCollectionFieldSchema; loading: boolean } {
  const { collectionId } = useStationCollection()
  const stationCollectionId = station.sourceCollectionId ?? collectionId
  const schemaCollectionId = isStationCollectionId(stationCollectionId) ? stationCollectionId : null
  const { fieldSchema, loading } = useStationCollectionFieldSchema(fieldSchemaOverride ? null : schemaCollectionId)

  return {
    fieldSchema: fieldSchemaOverride ?? fieldSchema,
    loading: fieldSchemaOverride ? false : loading,
  }
}
