import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDepartures } from '../../hooks/useDepartures'
import type { DepartureRow } from '../../types/darwin'
import { PageTopHeader } from '../../components/misc'
import { BUTWideButton, BUTTabButton } from '../../components/buttons'
import { TextCard } from '../../components/cards'
import TXTINPBUTIconWideButtonSearch from '../../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'
import './DarwinDeparturesPage.css'

const DEFAULT_CODE = 'LDS'

const WINDOW_OPTIONS = [
  { label: '1 hour',   value: 1 },
  { label: '3 hours',  value: 3 },
  { label: '6 hours',  value: 6 },
  { label: '12 hours', value: 12 },
]

const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="7" cy="7" r="4" />
    <line x1="11" y1="11" x2="13" y2="13" />
  </svg>
)

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London',
  })
}

function formatAge(ms: number | null): string {
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

/**
 * Compact pill rendered as the trailing element of each TextCard, replacing
 * the default chevron. Conveys live status at a glance.
 */
const StatusBadge: React.FC<{ row: DepartureRow }> = ({ row }) => {
  let cls = 'dep-badge'
  let text = 'On time'
  if (row.cancelled) {
    cls += ' dep-badge--cancelled'
    text = 'Cancelled'
  } else if (row.liveKind === 'actual') {
    cls += ' dep-badge--actual'
    text = `Departed ${row.liveTime}`
  } else if (row.liveKind === 'actual-arr') {
    cls += ' dep-badge--actual'
    text = `Arrived ${row.liveTime}`
  } else if (row.liveKind === 'est' && row.liveTime !== row.scheduledTime) {
    cls += ' dep-badge--late'
    text = `Exp ${row.liveTime}`
  } else if (row.liveKind === 'est-arr') {
    text = `Exp arr ${row.liveTime}`
  } else {
    cls += ' dep-badge--ontime'
  }
  return <span className={cls}>{text}</span>
}

/** Build the description string for a TextCard from a departure row. */
function buildDescription(row: DepartureRow): string {
  const platform = row.livePlatform || row.platform
  const platLabel = platform ? `Plat ${platform}` : 'No platform'
  const toc = row.tocName || row.toc
  const headcode = row.trainId
  const fromOrigin = row.originName ? `from ${row.originName}` : null

  if (row.cancelled && row.cancellation) {
    // Cancelled: lead with the reason — that's the most useful info.
    return `Cancelled — ${row.cancellation.reason}`
  }
  if (!row.cancelled && row.delayReason) {
    return `Delay reason: ${row.delayReason.reason}`
  }
  return [platLabel, toc, headcode, fromOrigin].filter(Boolean).join(' · ')
}

/** Build the title string. */
function buildTitle(row: DepartureRow): string {
  const time = formatTime(row.scheduledAt)
  const dest = row.destinationName || row.destination
  return `${time} · ${dest}`
}

const DarwinDeparturesPage: React.FC = () => {
  const params = useParams()
  const navigate = useNavigate()
  const code = (params.code || DEFAULT_CODE).toUpperCase()
  const [hours, setHours] = useState<number>(3)
  const [searchInput, setSearchInput] = useState<string>('')

  const { status, data, error, ageMs, refetch } = useDepartures({ code, hours })

  useEffect(() => { setSearchInput('') }, [code])

  const submitSearch = () => {
    const next = searchInput.trim().toUpperCase()
    if (!next || next === code) return
    navigate(`/departures/${next}`)
  }

  const stationLabel = useMemo(() => {
    if (data?.stationName) {
      return data.stationCrs ? `${data.stationName} (${data.stationCrs})` : data.stationName
    }
    return code
  }, [code, data])

  const subtitle = useMemo(() => {
    if (status === 'ok')        return `Live · updated ${formatAge(ageMs)}`
    if (status === 'stale')     return `Stale · ${formatAge(ageMs)}`
    if (status === 'loading')   return 'Loading live departures…'
    if (status === 'error')     return error ? `Error: ${error}` : 'Departures unavailable'
    if (status === 'not-found') return 'Unknown station'
    return ''
  }, [status, error, ageMs])

  return (
    <div className="darwin-departures-shell">
      <PageTopHeader
        title={stationLabel}
        subtitle={subtitle}
        className={`darwin-departures-header darwin-departures-header--${status}`}
      />

      <div className="darwin-departures-page">
        {/* ----- Controls panel ----- */}
        <section className="dep-controls-panel" aria-label="Filters">
          <div className="dep-controls-row">
            <div className="dep-control-group">
              <h2 className="dep-control-label">Station</h2>
              <div className="dep-search-row">
                <TXTINPBUTIconWideButtonSearch
                  id="darwin-station-search"
                  icon={<SearchIcon />}
                  value={searchInput}
                  onChange={setSearchInput}
                  placeholder="CRS or TIPLOC e.g. KGX, LEEDS"
                  className="dep-search-input"
                  colorVariant="primary"
                />
                <span className="dep-search-spacer" aria-hidden="true" />
                <BUTWideButton
                  width="hug"
                  instantAction
                  disabled={!searchInput.trim()}
                  onClick={submitSearch}
                >
                  Go
                </BUTWideButton>
              </div>
            </div>

            <div className="dep-control-group">
              <h2 className="dep-control-label">Window</h2>
              <div className="dep-window-buttons" role="tablist" aria-label="Look-ahead window">
                {WINDOW_OPTIONS.map((opt) => {
                  const selected = hours === opt.value
                  return (
                    <BUTTabButton
                      key={opt.value}
                      width="hug"
                      instantAction
                      state={selected ? 'pressed' : 'active'}
                      onClick={() => setHours(opt.value)}
                      ariaLabel={`Show next ${opt.label}`}
                    >
                      {opt.label}
                    </BUTTabButton>
                  )
                })}
              </div>
            </div>

            <div className="dep-control-group dep-control-group--actions">
              <BUTWideButton
                width="hug"
                instantAction
                colorVariant="primary"
                onClick={refetch}
              >
                Refresh
              </BUTWideButton>
            </div>
          </div>

          {/* Counts strip — sits at the bottom of the same panel as the
              search/window/refresh controls, so the page reads as one card. */}
          {data && (
            <div className="dep-summary" role="status" aria-live="polite">
              <div className="dep-summary-stat">
                <strong>{data.counts.departures}</strong>
                <span>departure{data.counts.departures === 1 ? '' : 's'}</span>
              </div>
              {data.counts.cancelled > 0 && (
                <div className="dep-summary-stat dep-summary-stat--cancel">
                  <strong>{data.counts.cancelled}</strong><span>cancelled</span>
                </div>
              )}
              {data.counts.withDelay > 0 && (
                <div className="dep-summary-stat dep-summary-stat--delay">
                  <strong>{data.counts.withDelay}</strong><span>with delay reason</span>
                </div>
              )}
              {data.alternates && data.alternates.length > 0 && (
                <div className="dep-summary-stat dep-summary-stat--alt">
                  <span>also matches:</span>
                  <strong>{data.alternates.join(', ')}</strong>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ----- Empty / error states ----- */}
        {status === 'not-found' && (
          <section className="dep-state-card dep-state-card--error">
            <h2>Station not found</h2>
            <p>
              No station matches the code <code>{code}</code>. Try a 3-letter CRS
              (e.g. <code>KGX</code>, <code>LDS</code>) or a TIPLOC
              (e.g. <code>LEEDS</code>, <code>KNGX</code>).
            </p>
          </section>
        )}

        {status === 'error' && !data && (
          <section className="dep-state-card dep-state-card--error">
            <h2>Departures unavailable</h2>
            <p>{error}</p>
            <p className="dep-hint">
              Is the daemon running? Start it with <code>npm run devdarwin</code> from the repo root.
            </p>
          </section>
        )}

        {status === 'loading' && !data && (
          <section className="dep-state-card">
            <p>Loading live departures…</p>
          </section>
        )}

        {/* ----- Board ----- */}
        {data && (
          <>
            {data.departures.length === 0 ? (
              <section className="dep-state-card">
                <p>No departures in the next {data.windowHours} hour{data.windowHours === 1 ? '' : 's'}.</p>
              </section>
            ) : (
              <div className="dep-cards" role="list">
                {data.departures.map((row) => (
                  <div role="listitem" key={row.rid}>
                    <TextCard
                      title={buildTitle(row)}
                      description={buildDescription(row)}
                      state={row.cancelled ? 'redAction' : 'default'}
                      trailingIcon={<StatusBadge row={row} />}
                      onClick={() => navigate(`/services/${encodeURIComponent(row.rid)}`)}
                      ariaLabel={`View details for ${formatTime(row.scheduledAt)} to ${row.destinationName || row.destination}, ${row.cancelled ? 'cancelled' : 'on time'}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <footer className="dep-footer">
              <span>Source: Network Rail Darwin Push Port</span>
              <span className="dep-footer-sep" aria-hidden="true">·</span>
              <span>Timetable: {data.timetableFile}</span>
              <span className="dep-footer-sep" aria-hidden="true">·</span>
              <span>Updated {new Date(data.updatedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</span>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

export default DarwinDeparturesPage
