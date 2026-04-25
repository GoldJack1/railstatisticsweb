import React, { useMemo, useState } from 'react'
import NavigationButton from '../../components/NavigationButton'
import BUTWideButton from '../../components/BUTWideButton'
import BUTCircleButton from '../../components/BUTCircleButton'
import BUTOperatorChip from '../../components/BUTOperatorChip'
import BUTVisitStatusButton from '../../components/BUTVisitStatusButton'
import BUTHeaderLink from '../../components/BUTHeaderLink'
import BUTFooterLink from '../../components/BUTFooterLink'
import '../../components/DesignSystemSitewideButtons.css'
import { getSitewideButtonAuditData, type SitewideAuditEntry } from '../../utils/sitewideButtonAudit'

const CATEGORY_LABELS: Record<SitewideAuditEntry['category'], string> = {
  'button-components': 'Button Components',
  'native-buttons': 'Native Buttons',
  'link-controls': 'Link/Text Controls',
  'card-actions': 'Card Action Controls',
  'text-inputs': 'Text Inputs',
}

const CATEGORY_HINTS: Record<SitewideAuditEntry['category'], string> = {
  'button-components': 'Primary candidates for style consolidation around BUT* wrappers.',
  'native-buttons': 'Native button tags that may need wrapper migration for consistency.',
  'link-controls': 'Route links and anchors used as textual controls (header/footer and content links).',
  'card-actions': 'Interactive controls in card-like surfaces and action bars.',
  'text-inputs': 'Text entry points across forms, search, auth, and admin flows.',
}

const renderRowExample = (category: SitewideAuditEntry['category'], item: string): React.ReactNode => {
  if (category === 'button-components') {
    if (item === 'BUTCircleButton') {
      return <BUTCircleButton ariaLabel="Example circle button" icon={<span aria-hidden="true">i</span>} />
    }
    if (item === 'BUTOperatorChip') {
      return <BUTOperatorChip width="hug">Example</BUTOperatorChip>
    }
    if (item === 'BUTVisitStatusButton') {
      return <BUTVisitStatusButton visited={false} />
    }
    if (item === 'BUTHeaderLink') {
      return <BUTHeaderLink to="/home" active>Home</BUTHeaderLink>
    }
    if (item === 'BUTFooterLink') {
      return <BUTFooterLink to="/privacy">Privacy Policy</BUTFooterLink>
    }
    if (item === 'NavigationButton') {
      return (
        <NavigationButton to="/design-system/sitewide-buttons" variant="wide" width="hug">
          Example
        </NavigationButton>
      )
    }
    return <BUTWideButton width="hug">Example</BUTWideButton>
  }

  if (category === 'native-buttons') {
    return <button type="button" className="ds-sitewide-buttons__native-example">Example native button</button>
  }

  if (category === 'link-controls') {
    return (
      <div className="ds-sitewide-buttons__example-inline-row ds-sitewide-buttons__example-inline-row--header">
        <div className="ds-sitewide-buttons__variant-stack">
          <span className="ds-sitewide-buttons__variant-label">Header link (inactive)</span>
          <BUTHeaderLink to="/migration">Migration</BUTHeaderLink>
        </div>
        <div className="ds-sitewide-buttons__variant-stack">
          <span className="ds-sitewide-buttons__variant-label">Header link (active)</span>
          <BUTHeaderLink to="/home" active>Home</BUTHeaderLink>
        </div>
        <div className="ds-sitewide-buttons__variant-stack">
          <span className="ds-sitewide-buttons__variant-label">Footer link</span>
          <BUTFooterLink to="/privacy">Privacy Policy</BUTFooterLink>
        </div>
      </div>
    )
  }

  if (category === 'card-actions') {
    return (
      <div className="ds-sitewide-buttons__example-inline-row">
        <BUTVisitStatusButton visited={false} />
        <BUTVisitStatusButton visited date="2026-03-16" />
        <BUTCircleButton ariaLabel="Info action" icon={<span aria-hidden="true">i</span>} />
        <BUTCircleButton ariaLabel="Favorite action" icon={<span aria-hidden="true">★</span>} />
        <BUTWideButton width="hug">View</BUTWideButton>
        <BUTWideButton width="hug" colorVariant="accent">Edit</BUTWideButton>
      </div>
    )
  }

  if (category === 'text-inputs') {
    if (item === '<textarea>') {
      return (
        <textarea
          className="ds-sitewide-buttons__textarea"
          rows={2}
          defaultValue="Example text area"
          aria-label="Example text area"
        />
      )
    }
    return <input type="text" className="ds-sitewide-buttons__input" value="Example input" readOnly aria-label="Example input" />
  }

  return null
}

const SitewideButtonsPage: React.FC = () => {
  const audit = useMemo(() => getSitewideButtonAuditData(), [])
  const [searchValue, setSearchValue] = useState('')
  const [notesValue, setNotesValue] = useState('')
  const [visited, setVisited] = useState(false)

  const grouped = useMemo(() => {
    return audit.entries.reduce<Record<SitewideAuditEntry['category'], SitewideAuditEntry[]>>(
      (acc, entry) => {
        acc[entry.category].push(entry)
        return acc
      },
      {
        'button-components': [],
        'native-buttons': [],
        'link-controls': [],
        'card-actions': [],
        'text-inputs': [],
      }
    )
  }, [audit.entries])

  const groupedUnique = useMemo(() => {
    return (Object.keys(grouped) as SitewideAuditEntry['category'][]).reduce<
      Record<
        SitewideAuditEntry['category'],
        Array<{
          id: string
          item: string
          occurrences: number
          files: string[]
          notes: string[]
        }>
      >
    >(
      (acc, category) => {
        const map = new Map<
          string,
          { id: string; item: string; occurrences: number; files: string[]; notes: Set<string> }
        >()

        grouped[category].forEach((entry) => {
          const key = entry.item
          const existing = map.get(key)
          if (!existing) {
            map.set(key, {
              id: `${category}-${entry.item}`,
              item: entry.item,
              occurrences: entry.occurrences,
              files: [entry.displayPath],
              notes: new Set(entry.notes ? [entry.notes] : []),
            })
            return
          }

          existing.occurrences += entry.occurrences
          if (!existing.files.includes(entry.displayPath)) {
            existing.files.push(entry.displayPath)
          }
          if (entry.notes) existing.notes.add(entry.notes)
        })

        acc[category] = Array.from(map.values())
          .map((row) => ({
            id: row.id,
            item: row.item,
            occurrences: row.occurrences,
            files: row.files.sort((a, b) => a.localeCompare(b)),
            notes: Array.from(row.notes),
          }))
          .sort((a, b) => a.item.localeCompare(b.item))

        return acc
      },
      {
        'button-components': [],
        'native-buttons': [],
        'link-controls': [],
        'card-actions': [],
        'text-inputs': [],
      }
    )
  }, [grouped])

  const headerFooterUsage = useMemo(() => {
    const buttonEntries = groupedUnique['button-components']
    const headerRow = buttonEntries.find((entry) => entry.item === 'BUTHeaderLink')
    const footerRow = buttonEntries.find((entry) => entry.item === 'BUTFooterLink')
    return {
      header: headerRow ?? null,
      footer: footerRow ?? null,
    }
  }, [groupedUnique])

  return (
    <div className="container">
      <div className="ds-sitewide-buttons">
        <NavigationButton
          to="/design-system"
          variant="wide"
          width="hug"
          colorVariant="primary"
          className="rs-button--text-size"
        >
          ← Back to Design System
        </NavigationButton>

        <header className="ds-sitewide-buttons__header">
          <h1>Sitewide Buttons Audit</h1>
          <p>
            Auto-generated inventory of interactive controls across pages and components. Use this view to standardize
            button usage, card actions, link-like controls, and text-entry fields.
          </p>
          <p className="ds-sitewide-buttons__meta">Generated: {new Date(audit.generatedAtIso).toLocaleString()}</p>
        </header>

        <section className="ds-sitewide-buttons__summary" aria-label="Sitewide controls summary">
          <article className="ds-sitewide-buttons__summary-card">
            <h2>Total Controls</h2>
            <strong>{audit.summary.totalControls}</strong>
          </article>
          <article className="ds-sitewide-buttons__summary-card">
            <h2>Button Components</h2>
            <strong>{audit.summary.buttonComponents}</strong>
          </article>
          <article className="ds-sitewide-buttons__summary-card">
            <h2>Native Buttons</h2>
            <strong>{audit.summary.nativeButtons}</strong>
          </article>
          <article className="ds-sitewide-buttons__summary-card">
            <h2>Link/Text Controls</h2>
            <strong>{audit.summary.linkControls}</strong>
          </article>
          <article className="ds-sitewide-buttons__summary-card">
            <h2>Text Inputs</h2>
            <strong>{audit.summary.textInputs}</strong>
          </article>
        </section>

        <section className="ds-sitewide-buttons__group">
          <div className="ds-sitewide-buttons__group-header">
            <h2>Header vs Footer Link Usage</h2>
            <p>Separated usage tracking for the dedicated link wrappers.</p>
          </div>
          <div className="ds-sitewide-buttons__examples-grid">
            <article className="ds-sitewide-buttons__example-card">
              <h3>BUTHeaderLink</h3>
              <p className="ds-sitewide-buttons__meta">
                Total: {headerFooterUsage.header?.occurrences ?? 0}
              </p>
              <div className="ds-sitewide-buttons__file-list">
                {(headerFooterUsage.header?.files ?? []).map((file) => (
                  <code key={`header-link-${file}`}>{file}</code>
                ))}
                {!headerFooterUsage.header && <span className="ds-sitewide-buttons__empty">No usage found.</span>}
              </div>
            </article>
            <article className="ds-sitewide-buttons__example-card">
              <h3>BUTFooterLink</h3>
              <p className="ds-sitewide-buttons__meta">
                Total: {headerFooterUsage.footer?.occurrences ?? 0}
              </p>
              <div className="ds-sitewide-buttons__file-list">
                {(headerFooterUsage.footer?.files ?? []).map((file) => (
                  <code key={`footer-link-${file}`}>{file}</code>
                ))}
                {!headerFooterUsage.footer && <span className="ds-sitewide-buttons__empty">No usage found.</span>}
              </div>
            </article>
          </div>
        </section>

        <section className="ds-sitewide-buttons__group">
          <div className="ds-sitewide-buttons__group-header">
            <h2>Visual Examples</h2>
            <p>Representative controls rendered from current UI patterns, so you can review look and interaction side-by-side with the audit tables.</p>
          </div>

          <div className="ds-sitewide-buttons__examples-grid">
            <article className="ds-sitewide-buttons__example-card">
              <h3>Button Components</h3>
              <div className="ds-sitewide-buttons__example-row">
                <BUTWideButton width="hug">Primary</BUTWideButton>
                <BUTOperatorChip width="hug">Chip</BUTOperatorChip>
                <BUTCircleButton ariaLabel="Info icon" icon={<span aria-hidden="true">i</span>} />
              </div>
            </article>

            <article className="ds-sitewide-buttons__example-card">
              <h3>Text / Link Controls</h3>
              <div className="ds-sitewide-buttons__example-row">
                <div className="ds-sitewide-buttons__variant-stack">
                  <span className="ds-sitewide-buttons__variant-label">Header link (inactive)</span>
                  <BUTHeaderLink to="/migration">Migration</BUTHeaderLink>
                </div>
                <div className="ds-sitewide-buttons__variant-stack">
                  <span className="ds-sitewide-buttons__variant-label">Header link (active)</span>
                  <BUTHeaderLink to="/home" active>Home</BUTHeaderLink>
                </div>
                <div className="ds-sitewide-buttons__variant-stack">
                  <span className="ds-sitewide-buttons__variant-label">Footer link</span>
                  <BUTFooterLink to="/privacy">Privacy Policy</BUTFooterLink>
                </div>
                <div className="ds-sitewide-buttons__variant-stack">
                  <span className="ds-sitewide-buttons__variant-label">Footer logout style</span>
                  <BUTFooterLink onActivate={() => undefined} className="site-footer-logout">
                    Log out
                  </BUTFooterLink>
                </div>
                <div className="ds-sitewide-buttons__variant-stack">
                  <span className="ds-sitewide-buttons__variant-label">Footer theme toggle style</span>
                  <BUTFooterLink onActivate={() => undefined} className="site-footer-theme-toggle">
                    Toggle theme
                  </BUTFooterLink>
                </div>
                <a href="https://www.railstatistics.co.uk" target="_blank" rel="noopener noreferrer" className="ds-sitewide-buttons__text-link">
                  External Text Link
                </a>
                <button type="button" className="ds-sitewide-buttons__text-button">Text Button</button>
              </div>
            </article>

            <article className="ds-sitewide-buttons__example-card">
              <h3>Card Actions</h3>
              <div className="ds-sitewide-buttons__example-row">
                <BUTVisitStatusButton visited={visited} onToggle={() => setVisited((current) => !current)} />
                <BUTVisitStatusButton visited date="2026-03-16" />
                <BUTCircleButton ariaLabel="Info action" icon={<span aria-hidden="true">i</span>} />
                <BUTCircleButton ariaLabel="Favorite action" icon={<span aria-hidden="true">★</span>} />
                <BUTWideButton width="hug">View</BUTWideButton>
                <BUTWideButton width="hug" colorVariant="accent">Edit</BUTWideButton>
                <BUTOperatorChip width="hug">Quick action</BUTOperatorChip>
              </div>
            </article>

            <article className="ds-sitewide-buttons__example-card">
              <h3>Text Inputs</h3>
              <div className="ds-sitewide-buttons__example-inputs">
                <input
                  type="search"
                  className="ds-sitewide-buttons__input"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search stations..."
                  aria-label="Search stations"
                />
                <textarea
                  className="ds-sitewide-buttons__textarea"
                  value={notesValue}
                  onChange={(event) => setNotesValue(event.target.value)}
                  placeholder="Notes / free text"
                  rows={3}
                  aria-label="Free text notes"
                />
              </div>
            </article>
          </div>
        </section>

        {(Object.keys(CATEGORY_LABELS) as SitewideAuditEntry['category'][]).map((category) => (
          <section key={category} className="ds-sitewide-buttons__group">
            <div className="ds-sitewide-buttons__group-header">
              <h2>{CATEGORY_LABELS[category]}</h2>
              <p>{CATEGORY_HINTS[category]}</p>
            </div>

            {groupedUnique[category].length === 0 ? (
              <p className="ds-sitewide-buttons__empty">No entries found.</p>
            ) : (
              <div className="ds-sitewide-buttons__table-wrap">
                <table className="ds-sitewide-buttons__table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Files</th>
                      <th>Count</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedUnique[category].map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div className="ds-sitewide-buttons__item-cell">
                            <span>{entry.item}</span>
                            <div className="ds-sitewide-buttons__item-example">
                              {renderRowExample(category, entry.item)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="ds-sitewide-buttons__file-list">
                            {entry.files.map((file) => (
                              <code key={`${entry.id}-${file}`}>{file}</code>
                            ))}
                          </div>
                        </td>
                        <td>{entry.occurrences}</td>
                        <td>{entry.notes.length > 0 ? entry.notes.join(' | ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

export default SitewideButtonsPage

