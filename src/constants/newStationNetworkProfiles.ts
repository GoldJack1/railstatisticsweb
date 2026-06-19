import type { NetworkCollectionId } from './stationCollections'
import { NETWORK_STNAREA_DEFAULTS } from './stationCollections'

export type NewStationNetworkProfile = {
  description: string
  defaultStnarea: string
  showBorough: boolean
  showFareZone: boolean
  showNlc: boolean
  showStaffingLevel: boolean
  showMinConnectionTime: boolean
  showOperatorCode: boolean
  showStepFreeTab: boolean
  showFacilitiesTab: boolean
  showRequestStop: boolean
}

export const NEW_STATION_NETWORK_PROFILES: Record<NetworkCollectionId, NewStationNetworkProfile> = {
  stations_gbnr: {
    description: 'National Rail — borough, fare zones, and full facilities fields.',
    defaultStnarea: NETWORK_STNAREA_DEFAULTS.stations_gbnr,
    showBorough: true,
    showFareZone: true,
    showNlc: false,
    showStaffingLevel: false,
    showMinConnectionTime: true,
    showOperatorCode: true,
    showStepFreeTab: true,
    showFacilitiesTab: true,
    showRequestStop: true,
  },
  stations_nitranslink: {
    description: 'NI Translink — province, post/Eircode, and core station details.',
    defaultStnarea: NETWORK_STNAREA_DEFAULTS.stations_nitranslink,
    showBorough: false,
    showFareZone: false,
    showNlc: false,
    showStaffingLevel: false,
    showMinConnectionTime: false,
    showOperatorCode: true,
    showStepFreeTab: false,
    showFacilitiesTab: false,
    showRequestStop: false,
  },
  stations_roiirerail: {
    description: 'Irish Rail — province, post/Eircode, and core station details.',
    defaultStnarea: NETWORK_STNAREA_DEFAULTS.stations_roiirerail,
    showBorough: false,
    showFareZone: false,
    showNlc: false,
    showStaffingLevel: false,
    showMinConnectionTime: false,
    showOperatorCode: true,
    showStepFreeTab: false,
    showFacilitiesTab: false,
    showRequestStop: false,
  },
  stations_gbheritage: {
    description: 'GB Heritage — borough, NLC, staffing, step-free, URL slug, and request-stop fields.',
    defaultStnarea: NETWORK_STNAREA_DEFAULTS.stations_gbheritage,
    showBorough: true,
    showFareZone: false,
    showNlc: true,
    showStaffingLevel: true,
    showMinConnectionTime: false,
    showOperatorCode: false,
    showStepFreeTab: true,
    showFacilitiesTab: false,
    showRequestStop: true,
  },
}

export function getNewStationNetworkProfile(collectionId: NetworkCollectionId): NewStationNetworkProfile {
  return NEW_STATION_NETWORK_PROFILES[collectionId]
}
