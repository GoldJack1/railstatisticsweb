type AuditCategory =
  | 'button-components'
  | 'native-buttons'
  | 'link-controls'
  | 'card-actions'
  | 'text-inputs'

export interface SitewideAuditEntry {
  id: string
  filePath: string
  displayPath: string
  item: string
  category: AuditCategory
  occurrences: number
  notes?: string
}

export interface SitewideAuditSummary {
  totalControls: number
  buttonComponents: number
  nativeButtons: number
  linkControls: number
  textInputs: number
}

export interface SitewideButtonAuditData {
  generatedAtIso: string
  summary: SitewideAuditSummary
  entries: SitewideAuditEntry[]
}

const SOURCE_FILES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const BUTTON_COMPONENT_NAMES = [
  'BUTMappedButton',
  'BUTWideButton',
  'BUTCircleButton',
  'BUTOperatorChip',
  'BUTSquareButton',
  'BUTTwoButtonBar',
  'BUTThreeButtonBar',
  'BUTVisitStatusButton',
  'BUTHeaderLink',
  'BUTFooterLink',
  'NavigationButton',
]

const countMatches = (source: string, regex: RegExp): number => {
  const matches = source.match(regex)
  return matches ? matches.length : 0
}

const toDisplayPath = (absoluteLikePath: string): string =>
  absoluteLikePath.startsWith('/src/') ? absoluteLikePath.slice(1) : absoluteLikePath

const makeId = (filePath: string, item: string, category: AuditCategory): string =>
  `${filePath}::${item}::${category}`

const pushIfAny = (
  out: SitewideAuditEntry[],
  filePath: string,
  item: string,
  category: AuditCategory,
  occurrences: number,
  notes?: string
) => {
  if (occurrences <= 0) return
  out.push({
    id: makeId(filePath, item, category),
    filePath,
    displayPath: toDisplayPath(filePath),
    item,
    category,
    occurrences,
    notes,
  })
}

export const getSitewideButtonAuditData = (): SitewideButtonAuditData => {
  const entries: SitewideAuditEntry[] = []

  Object.entries(SOURCE_FILES)
    .filter(([path]) => path.startsWith('/src/pages/') || path.startsWith('/src/components/'))
    .forEach(([filePath, source]) => {
      if (filePath.endsWith('.d.ts')) return

      BUTTON_COMPONENT_NAMES.forEach((componentName) => {
        const occurrences = countMatches(source, new RegExp(`<${componentName}\\b`, 'g'))
        pushIfAny(entries, filePath, componentName, 'button-components', occurrences)
      })

      pushIfAny(entries, filePath, '<button>', 'native-buttons', countMatches(source, /<button\b/g))
      pushIfAny(entries, filePath, '<a>', 'link-controls', countMatches(source, /<a\b/g))
      pushIfAny(entries, filePath, '<Link>', 'link-controls', countMatches(source, /<Link\b/g))

      const linkClassButtons =
        countMatches(source, /<button\b[^>]*className=\{?["'`][^"'`]*link[^"'`]*["'`]\}?[^>]*>/g) +
        countMatches(source, /<a\b[^>]*className=\{?["'`][^"'`]*link[^"'`]*["'`]\}?[^>]*>/g)
      pushIfAny(
        entries,
        filePath,
        'link-styled control',
        'link-controls',
        linkClassButtons,
        'Class name contains "link"'
      )

      const likelyCardFile = /Card|ActionBar|Row/.test(filePath)
      const cardButtonHits = countMatches(source, /<button\b/g) + countMatches(source, /<BUT\w+\b/g)
      if (likelyCardFile || /card|action-bar|toolbar/i.test(source)) {
        pushIfAny(entries, filePath, 'card/action controls', 'card-actions', cardButtonHits)
      }

      pushIfAny(entries, filePath, '<input>', 'text-inputs', countMatches(source, /<input\b/g))
      pushIfAny(entries, filePath, '<textarea>', 'text-inputs', countMatches(source, /<textarea\b/g))
    })

  entries.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    if (a.displayPath !== b.displayPath) return a.displayPath.localeCompare(b.displayPath)
    return a.item.localeCompare(b.item)
  })

  const sumByCategory = (categories: AuditCategory[]) =>
    entries
      .filter((entry) => categories.includes(entry.category))
      .reduce((total, entry) => total + entry.occurrences, 0)

  const summary: SitewideAuditSummary = {
    totalControls: entries.reduce((total, entry) => total + entry.occurrences, 0),
    buttonComponents: sumByCategory(['button-components']),
    nativeButtons: sumByCategory(['native-buttons']),
    linkControls: sumByCategory(['link-controls']),
    textInputs: sumByCategory(['text-inputs']),
  }

  return {
    generatedAtIso: new Date().toISOString(),
    summary,
    entries,
  }
}

