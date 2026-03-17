/**
 * Station area → category and URL slug.
 * Used to build station detail URLs: {category}-{areaSlug}-{stationId}
 * e.g. rail-greatbritainnationalrail-0002
 */

/** Categories for station URLs (rail + placeholders for future: metro, trams, tramtrain) */
export const STATION_CATEGORIES = ['rail', 'metro', 'trams', 'tramtrain'] as const
export type StationCategory = (typeof STATION_CATEGORIES)[number]

export interface StationAreaConfig {
  category: StationCategory
  slug: string
}

/**
 * Maps station area code (from Firebase stnarea) to category and URL slug.
 * GBNR = Great Britain National Rail → rail / greatbritainnationalrail.
 * Placeholder categories (metro, trams, tramtrain) can be extended when areas are added.
 */
const STATION_AREA_MAP: Record<string, StationAreaConfig> = {
  GBNR: { category: 'rail', slug: 'greatbritainnationalrail' }
  // Future: e.g. METRO: { category: 'metro', slug: '...' }, TRAMS: { category: 'trams', slug: '...' }
}

const DEFAULT_CATEGORY: StationCategory = 'rail'

function slugifyFallback(area: string): string {
  return area
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Get category and slug for a station area code (e.g. GBNR).
 * Unknown areas default to rail and a slugified area code.
 */
export function getStationAreaConfig(area: string | null | undefined): StationAreaConfig {
  if (!area || typeof area !== 'string') {
    return { category: DEFAULT_CATEGORY, slug: 'rail' }
  }
  const key = area.trim().toUpperCase()
  const config = STATION_AREA_MAP[key]
  if (config) return config
  return { category: DEFAULT_CATEGORY, slug: slugifyFallback(area) || 'rail' }
}

export function getCategoryForStationArea(area: string | null | undefined): StationCategory {
  return getStationAreaConfig(area).category
}

export function getAreaSlug(area: string | null | undefined): string {
  return getStationAreaConfig(area).slug
}

/**
 * Build station detail path segment: {category}-{areaSlug}-{stationId}
 * e.g. rail-greatbritainnationalrail-0002
 */
export function buildStationPath(station: { id: string; stnarea?: string | null }): string {
  const { category, slug } = getStationAreaConfig(station.stnarea ?? null)
  return `${category}-${slug}-${station.id}`
}

/**
 * Parse a path segment to get station ID.
 * Accepts:
 * - New format: rail-greatbritainnationalrail-0002 → 0002
 * - Legacy: 0002 → 0002
 */
export function parseStationPath(pathSegment: string): string {
  if (!pathSegment || pathSegment === 'new') return pathSegment
  const parts = pathSegment.split('-')
  if (parts.length >= 3) {
    // category-areaSlug-id: id is last segment
    return parts[parts.length - 1]
  }
  return pathSegment
}
