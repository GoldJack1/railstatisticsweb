export type StationAdminDisplayMode = 'cards' | 'table'

const STATION_ADMIN_DISPLAY_MODE_STORAGE_KEY = 'railstatistics-station-admin-display-mode-v1'

export const STATION_ADMIN_DISPLAY_MODE_CHANGED_EVENT =
  'railstatistics-station-admin-display-mode-changed'

export function readStationAdminDisplayMode(): StationAdminDisplayMode {
  if (typeof window === 'undefined') return 'cards'
  try {
    const value = localStorage.getItem(STATION_ADMIN_DISPLAY_MODE_STORAGE_KEY)
    return value === 'table' ? 'table' : 'cards'
  } catch {
    return 'cards'
  }
}

export function writeStationAdminDisplayMode(mode: StationAdminDisplayMode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STATION_ADMIN_DISPLAY_MODE_STORAGE_KEY, mode)
    window.dispatchEvent(new Event(STATION_ADMIN_DISPLAY_MODE_CHANGED_EVENT))
  } catch {
    /* quota / private mode */
  }
}
