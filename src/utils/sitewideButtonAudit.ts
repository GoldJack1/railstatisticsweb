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
  unusedFiles: string[]
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
  'BUTLink',
]

const NATIVE_BUTTON_AUDIT_EXCLUDED_FILES = new Set([
  '/src/components/BUTBaseButton.tsx',
  '/src/components/BUTBaseButtonBar.tsx',
  '/src/components/BUTBaseVisitStatusButton.tsx',
])

const countMatches = (source: string, regex: RegExp): number => {
  const matches = source.match(regex)
  return matches ? matches.length : 0
}

const toDisplayPath = (absoluteLikePath: string): string =>
  absoluteLikePath.startsWith('/src/') ? absoluteLikePath.slice(1) : absoluteLikePath

const makeId = (filePath: string, item: string, category: AuditCategory): string =>
  `${filePath}::${item}::${category}`

const normalizePath = (path: string): string => {
  const segments = path.split('/')
  const out: string[] = []

  segments.forEach((segment) => {
    if (!segment || segment === '.') return
    if (segment === '..') {
      out.pop()
      return
    }
    out.push(segment)
  })

  return `/${out.join('/')}`
}

const dirname = (path: string): string => {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '/' : path.slice(0, index)
}

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
  const EXCLUDED_AUDIT_PAGE = '/src/pages/designSystem/SitewideButtonsPage.tsx'
  const scopedFiles = Object.keys(SOURCE_FILES).filter(
    (path) =>
      (path.startsWith('/src/pages/') || path.startsWith('/src/components/')) &&
      !path.endsWith('.d.ts') &&
      path !== EXCLUDED_AUDIT_PAGE
  )
  const scopedFileSet = new Set(scopedFiles)

  scopedFiles.forEach((filePath) => {
    const source = SOURCE_FILES[filePath]

    BUTTON_COMPONENT_NAMES.forEach((componentName) => {
      const occurrences = countMatches(source, new RegExp(`<${componentName}\\b`, 'g'))
      pushIfAny(entries, filePath, componentName, 'button-components', occurrences)
    })

    if (!NATIVE_BUTTON_AUDIT_EXCLUDED_FILES.has(filePath)) {
      pushIfAny(entries, filePath, '<button>', 'native-buttons', countMatches(source, /<button\b/g))
    }
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

  const referencedFiles = new Set<string>()
  const importPattern = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

  scopedFiles.forEach((filePath) => {
    const source = SOURCE_FILES[filePath]
    const matches = source.matchAll(importPattern)

    for (const match of matches) {
      const rawImport = match[1] ?? match[2]
      if (!rawImport) continue

      const resolvedBases: string[] = []
      if (rawImport.startsWith('.')) {
        resolvedBases.push(normalizePath(`${dirname(filePath)}/${rawImport}`))
      } else if (rawImport.startsWith('/src/')) {
        resolvedBases.push(normalizePath(rawImport))
      } else if (rawImport.startsWith('@/')) {
        resolvedBases.push(normalizePath(`/src/${rawImport.slice(2)}`))
      } else {
        continue
      }

      resolvedBases.forEach((base) => {
        ;[base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].forEach((candidate) => {
          if (scopedFileSet.has(candidate)) {
            referencedFiles.add(candidate)
          }
        })
      })
    }
  })

  const unusedFiles = scopedFiles
    .filter((filePath) => !referencedFiles.has(filePath))
    .filter((filePath) => !filePath.endsWith('/App.tsx'))
    .map((filePath) => toDisplayPath(filePath))
    .sort((a, b) => a.localeCompare(b))

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
    unusedFiles,
  }
}

