import type { StationCollectionId } from '../constants/stationCollections'

export const LIGHTRAIL_COLLECTION_ID = 'lightrail_GBSHEFFSUPERTRAM' as const satisfies StationCollectionId

/** Firestore field names for South Yorkshire SuperTram (CSV headers except mapped core fields). */
export const LIGHT_RAIL_DOC_FIELDS = {
  stopName: 'StopName',
  dateOpened: 'Date Opened',
  linesServed: 'Lines Served',
  isLimitedService: 'IsLimitedService',
  platforms: 'Platforms',
  isStaffed: 'IsStaffed',
  isStepFree: 'IsStepFree',
  hasLift: 'HasLift',
  fareZone: 'FareZone',
  bus: 'Bus',
  train: 'Train',
} as const

export type LightRailDocFieldKey = (typeof LIGHT_RAIL_DOC_FIELDS)[keyof typeof LIGHT_RAIL_DOC_FIELDS]

export const LIGHT_RAIL_ADDITIONAL_FIELD_KEYS: LightRailDocFieldKey[] = [
  LIGHT_RAIL_DOC_FIELDS.stopName,
  LIGHT_RAIL_DOC_FIELDS.dateOpened,
  LIGHT_RAIL_DOC_FIELDS.linesServed,
  LIGHT_RAIL_DOC_FIELDS.isLimitedService,
  LIGHT_RAIL_DOC_FIELDS.platforms,
  LIGHT_RAIL_DOC_FIELDS.isStaffed,
  LIGHT_RAIL_DOC_FIELDS.isStepFree,
  LIGHT_RAIL_DOC_FIELDS.hasLift,
  LIGHT_RAIL_DOC_FIELDS.fareZone,
  LIGHT_RAIL_DOC_FIELDS.bus,
  LIGHT_RAIL_DOC_FIELDS.train,
]

/** Light-rail fields stored only via pending `sandboxUpdated` (not core station update). */
export const LIGHT_RAIL_SANDBOX_ONLY_FIELD_KEYS: LightRailDocFieldKey[] =
  LIGHT_RAIL_ADDITIONAL_FIELD_KEYS.filter(
    (key) => key !== LIGHT_RAIL_DOC_FIELDS.stopName && key !== LIGHT_RAIL_DOC_FIELDS.fareZone
  )

export function isLightRailCollection(collectionId: string | null | undefined): boolean {
  return collectionId === LIGHTRAIL_COLLECTION_ID
}

export function readLightRailDocField(
  doc: Record<string, unknown> | null | undefined,
  field: LightRailDocFieldKey
): unknown {
  if (!doc) return undefined
  return doc[field]
}

export function readLightRailDocString(
  doc: Record<string, unknown> | null | undefined,
  field: LightRailDocFieldKey
): string {
  const value = readLightRailDocField(doc, field)
  if (value === null || value === undefined) return ''
  return String(value)
}

export function pickLightRailAdditionalFields(
  doc: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  if (!doc) return picked
  for (const key of LIGHT_RAIL_ADDITIONAL_FIELD_KEYS) {
    if (doc[key] !== undefined) picked[key] = doc[key]
  }
  return picked
}

/** Fields written through pending sandbox merge only (excludes StopName + FareZone on core update). */
export function pickLightRailSandboxOnlyFields(
  doc: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  if (!doc) return picked
  for (const key of LIGHT_RAIL_SANDBOX_ONLY_FIELD_KEYS) {
    if (doc[key] !== undefined) picked[key] = doc[key]
  }
  return picked
}

export function buildLightRailAdditionalSavePayload(
  additionalForm: Record<string, unknown>
): Record<string, unknown> {
  return pickLightRailSandboxOnlyFields(additionalForm)
}

function normalizeLightRailFieldValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/** Only light-rail sandbox fields that differ from the Firestore document. */
export function pickChangedLightRailSandboxFields(
  form: Record<string, unknown> | null | undefined,
  originalDoc: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const draft = pickLightRailSandboxOnlyFields(form)
  const original = pickLightRailSandboxOnlyFields(originalDoc)
  const changed: Record<string, unknown> = {}

  for (const key of LIGHT_RAIL_SANDBOX_ONLY_FIELD_KEYS) {
    const draftVal = draft[key]
    if (draftVal === undefined) continue
    if (normalizeLightRailFieldValue(original[key]) !== normalizeLightRailFieldValue(draftVal)) {
      changed[key] = draftVal
    }
  }

  return changed
}

/** SuperTram line chip colours (background + contrasting text). */
export const LIGHT_RAIL_LINE_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  'Tram-Train': { bg: '#000000', text: '#ffffff' },
  Blue: { bg: '#2d83c0', text: '#ffffff' },
  Yellow: { bg: '#ecb739', text: '#1a1a1a' },
  Purple: { bg: '#5f195e', text: '#ffffff' },
}

/** All selectable SuperTram lines, in canonical save order for `Lines Served`. */
export const LIGHT_RAIL_LINE_OPTIONS = ['Blue', 'Yellow', 'Purple', 'Tram-Train'] as const

export type LightRailLineOption = (typeof LIGHT_RAIL_LINE_OPTIONS)[number]

const LIGHT_RAIL_LINE_CHIP_FALLBACK = { bg: '#64748b', text: '#ffffff' }

export function normalizeLightRailLineName(line: string): string {
  const trimmed = line.trim()
  const match = LIGHT_RAIL_LINE_OPTIONS.find((key) => key.toLowerCase() === trimmed.toLowerCase())
  return match ?? trimmed
}

export function parseLightRailLinesServed(raw: string | null | undefined): string[] {
  if (!raw || String(raw).trim() === '') return []
  return String(raw)
    .split(',')
    .map((part) => normalizeLightRailLineName(part.trim()))
    .filter((part) => part !== '')
}

export function parseLightRailLinesServedSet(raw: string | null | undefined): Set<string> {
  return new Set(parseLightRailLinesServed(raw))
}

/** Serialize selected lines to Firestore `Lines Served` (e.g. `Blue, Yellow, Purple`). */
export function serializeLightRailLinesServed(selected: Iterable<string>): string {
  const normalized = new Set([...selected].map(normalizeLightRailLineName).filter(Boolean))
  return LIGHT_RAIL_LINE_OPTIONS.filter((line) => normalized.has(line)).join(', ')
}

export function getLightRailLineChipColors(line: string): { bg: string; text: string } {
  const normalized = normalizeLightRailLineName(line)
  return LIGHT_RAIL_LINE_CHIP_COLORS[normalized] ?? LIGHT_RAIL_LINE_CHIP_FALLBACK
}

/** Preset platform identifiers for SuperTram `Platforms` field. */
export const LIGHT_RAIL_PLATFORM_OPTIONS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
] as const

export type LightRailPlatformOption = (typeof LIGHT_RAIL_PLATFORM_OPTIONS)[number]

export function normalizeLightRailPlatform(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  const letter = trimmed.toUpperCase()
  if (/^[A-F]$/.test(letter) && LIGHT_RAIL_PLATFORM_OPTIONS.includes(letter as LightRailPlatformOption)) {
    return letter
  }
  if (/^[1-6]$/.test(trimmed)) return trimmed
  return trimmed
}

export function parseLightRailPlatforms(raw: string | null | undefined): string[] {
  if (!raw || String(raw).trim() === '') return []
  return String(raw)
    .split(',')
    .map((part) => normalizeLightRailPlatform(part))
    .filter((part) => part !== '')
}

export function parseLightRailPlatformsSet(raw: string | null | undefined): Set<string> {
  return new Set(parseLightRailPlatforms(raw))
}

/** Serialize selected platforms to Firestore `Platforms` (e.g. `A, B` or `3, 4`). */
export function serializeLightRailPlatforms(selected: Iterable<string>): string {
  const normalized = new Set([...selected].map(normalizeLightRailPlatform).filter(Boolean))
  return LIGHT_RAIL_PLATFORM_OPTIONS.filter((platform) => normalized.has(platform)).join(', ')
}
