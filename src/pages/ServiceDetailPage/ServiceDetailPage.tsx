import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useServiceDetail } from '../../hooks/useServiceDetail'
import { PageTopHeader } from '../../components/misc'
import { BUTWideButton } from '../../components/buttons'
import { ActivityPill } from '../../components/darwin/ActivityPill'
import { CarriageMap } from '../../components/darwin/CarriageMap'
import type { ServiceDetail } from '../../types/darwin'
import './ServiceDetailPage.css'

const SLOT_KIND: Record<string, 'origin' | 'stop' | 'pass' | 'destination'> = {
  OR:   'origin', OPOR: 'origin',
  IP:   'stop',   OPIP: 'stop',
  PP:   'pass',   OPPP: 'pass',
  DT:   'destination', OPDT: 'destination',
}

/**
 * Phrase a Darwin association into a sentence the passenger can act on.
 * The "main" side of an association is the train that *continues onward* with
 * (most of) the formation; the "associated" side is the joining/leaving
 * portion. From the perspective of *this* RID we tailor the verb:
 *   - VV / divide:     this train splits — the associated portion goes elsewhere.
 *   - JJ / join:       this train joins another — the associated portion will be attached.
 *   - NP / next portion: this train ends and continues *as* the next service.
 */
function describeAssociation(a: NonNullable<ReturnType<typeof useServiceDetail>['data']>['associations'][number]): string {
  const where = a.tiplocName || a.tiploc
  const otherDest = a.otherDestinationName || 'another destination'
  const otherOrig = a.otherOriginName || 'elsewhere'
  const headcode  = a.otherTrainId ? ` (${a.otherTrainId})` : ''
  const time = a.role === 'main' ? a.assocTime : a.mainTime
  const timeText = time ? `${time.replace(/:00$/, '').replace(/(\d{2}:\d{2}).*/, '$1')} ` : ''
  switch (a.category) {
    case 'VV':
      return `This train splits at ${where}. The other portion forms ${timeText}to ${otherDest}${headcode}.`
    case 'JJ':
      return `This train joins another at ${where}. The other portion is ${timeText}from ${otherOrig}${headcode}.`
    case 'NP':
      return a.role === 'main'
        ? `This train continues as ${timeText}to ${otherDest}${headcode} from ${where}.`
        : `This train forms from ${timeText}from ${otherOrig}${headcode} at ${where}.`
    default:
      return `Associated with ${a.otherTrainId || a.otherRid} at ${where}.`
  }
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

/** Strip seconds from working times so HH:MM:30 reads as HH:MM. */
function trimSeconds(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

/**
 * Collapsible "raw data" panel rendered at the bottom of the service detail
 * page. Shows the full ServiceDetail payload as pretty-printed JSON, plus a
 * couple of summary chips so power users can see at a glance which feeds
 * contributed which sections. Two convenience buttons: copy-to-clipboard
 * and open-raw-API in a new tab.
 *
 * Defined inline (rather than as its own component file) because it's only
 * used on this one page and depends on the local layout tokens.
 */
const RawDataDump: React.FC<{ data: ServiceDetail }> = ({ data }) => {
  const [open, setOpen] = useState(false)
  // Quick "what's populated" summary so the user can see whether a missing
  // section is "feed didn't publish" vs "field doesn't exist". Cheap to
  // render even on every poll, so we leave it always-on.
  const present: Array<[string, boolean | number]> = [
    ['Darwin formation',  !!data.formation],
    ['PTAC consist',      !!data.consist],
    ['Reverse formation', data.reverseFormation],
    ['Cancellation',      data.cancelled],
    ['Partial cancel',    data.partiallyCancelled],
    ['Delay reason',      !!data.delayReason],
    ['Associations',      data.associations?.length || 0],
    ['Alerts',            data.alerts?.length || 0],
    ['Stops',             data.stops?.length || 0],
    ['Stops with loading', (data.stops || []).filter((s: ServiceDetail['stops'][number]) => s.coachLoading || s.loadingPercentage != null).length],
  ]
  const apiUrl = `/api/darwin/service/${encodeURIComponent(data.rid)}`
  return (
    <details className="svc-rawdump" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="svc-rawdump-summary">
        <span className="svc-rawdump-title">Raw data</span>
        <span className="svc-rawdump-hint">{open ? 'click to collapse' : 'click to expand the full daemon payload'}</span>
      </summary>
      <div className="svc-rawdump-meta">
        {present.map(([label, val]) => (
          <span key={label} className={`svc-rawdump-chip${val ? ' svc-rawdump-chip--present' : ''}`}>
            <strong>{label}:</strong>{' '}
            {typeof val === 'boolean' ? (val ? 'yes' : 'no') : val}
          </span>
        ))}
      </div>
      <div className="svc-rawdump-actions">
        <a
          className="svc-rawdump-btn svc-rawdump-btn--link"
          href={apiUrl}
          target="_blank"
          rel="noopener"
        >Open API URL ↗</a>
      </div>
      {/* Heavy JSON stringification + DOM is gated behind `open` so the
       * service-detail page doesn't pay the cost on every poll while the
       * panel is collapsed. The body is also memoised by RID + updatedAt
       * so polls that return the same data don't trigger re-stringify. */}
      {open && <RawDataBody data={data} />}
    </details>
  )
}

/**
 * The expensive part of the raw-data dump — only mounts when the parent
 * `<details>` is open. Memoised on `(rid, updatedAt)` so a fresh data ref
 * with identical content (common with polling hooks) doesn't re-stringify.
 */
const RawDataBody: React.FC<{ data: ServiceDetail }> = React.memo(
  ({ data }) => {
    const json = useMemo(() => JSON.stringify(data, null, 2), [data])
    return (
      <>
        <div className="svc-rawdump-actions">
          <button
            type="button"
            className="svc-rawdump-btn"
            onClick={() => navigator.clipboard?.writeText(json).catch(() => {})}
          >Copy JSON</button>
          <span className="svc-rawdump-bytes">{(json.length / 1024).toFixed(1)} KB</span>
        </div>
        <pre className="svc-rawdump-pre"><code>{json}</code></pre>
      </>
    )
  },
  (prev, next) =>
    prev.data.rid === next.data.rid && prev.data.updatedAt === next.data.updatedAt
)

const ServiceDetailPage: React.FC = () => {
  const params   = useParams()
  const navigate = useNavigate()
  const rid = params.rid || ''

  const { status, data, error, ageMs, refetch } = useServiceDetail({ rid })

  const title = useMemo(() => {
    if (!data) return rid
    const dest = data.destinationName || data.destination
    return `${data.trainId} · ${data.originName || data.origin} → ${dest}`
  }, [data, rid])

  const subtitle = useMemo(() => {
    if (status === 'ok')        return `Live · updated ${formatAge(ageMs)}`
    if (status === 'stale')     return `Stale · ${formatAge(ageMs)}`
    if (status === 'loading')   return 'Loading service detail…'
    if (status === 'error')     return error ? `Error: ${error}` : 'Service unavailable'
    if (status === 'not-found') return 'Service not found'
    return ''
  }, [status, error, ageMs])

  return (
    <div className="service-detail-shell">
      <PageTopHeader
        title={title}
        subtitle={subtitle}
        className={`service-detail-header service-detail-header--${status}`}
        actionButton={{
          label: '← Back',
          onClick: () => (window.history.length > 1 ? navigate(-1) : navigate('/departures')),
        }}
      />

      <div className="service-detail-page">
        {status === 'not-found' && (
          <section className="svc-state-card svc-state-card--error">
            <h2>Service not found</h2>
            <p>RID <code>{rid}</code> isn’t in today’s timetable. It may have already run, or the daemon may be using yesterday’s file.</p>
          </section>
        )}

        {status === 'error' && !data && (
          <section className="svc-state-card svc-state-card--error">
            <h2>Service unavailable</h2>
            <p>{error}</p>
            <p className="svc-hint">
              Is the daemon running? Start it with <code>npm run devdarwin</code> from the repo root.
            </p>
          </section>
        )}

        {status === 'loading' && !data && (
          <section className="svc-state-card">
            <p>Loading service detail…</p>
          </section>
        )}

        {data && (
          <>
            <section
              className={`svc-summary-card ${data.cancelled ? 'svc-summary-card--cancelled' : ''}`}
              aria-label="Service summary"
            >
              <div className="svc-summary-grid">
                <div className="svc-summary-item">
                  <span className="svc-summary-label">Operator</span>
                  <span className="svc-summary-value">{data.tocName || data.toc}</span>
                </div>
                <div className="svc-summary-item">
                  <span className="svc-summary-label">Headcode</span>
                  <span className="svc-summary-value svc-mono">{data.trainId}</span>
                </div>
                <div className="svc-summary-item">
                  <span className="svc-summary-label">UID</span>
                  <span className="svc-summary-value svc-mono">{data.uid}</span>
                </div>
                <div className="svc-summary-item">
                  <span className="svc-summary-label">Service date</span>
                  <span className="svc-summary-value svc-mono">{data.ssd}</span>
                </div>
                <div className="svc-summary-item">
                  <span className="svc-summary-label">Origin</span>
                  <span className="svc-summary-value">{data.originName || data.origin}</span>
                </div>
                <div className="svc-summary-item">
                  <span className="svc-summary-label">Destination</span>
                  <span className="svc-summary-value">{data.destinationName || data.destination}</span>
                </div>
                <div className="svc-summary-item">
                  <span className="svc-summary-label">Stops</span>
                  <span className="svc-summary-value svc-mono">{data.stops.filter(s => SLOT_KIND[s.slot] !== 'pass').length}</span>
                </div>
                <div className="svc-summary-item">
                  <span className="svc-summary-label">Type</span>
                  <span className="svc-summary-value">
                    {data.isPassenger ? 'Passenger' : 'Non-passenger'}
                    {data.trainCat ? ` · ${data.trainCat}` : ''}
                  </span>
                </div>
              </div>

              {data.cancelled && data.cancellation && (
                <div className="svc-banner svc-banner--cancel">
                  <span className="svc-banner-label">Cancelled —</span> {data.cancellation.reason}
                  {data.cancellation.code && <span className="svc-banner-code"> (code {data.cancellation.code})</span>}
                </div>
              )}
              {!data.cancelled && data.partiallyCancelled && (() => {
                const cancelledStops = data.stops.filter((s) => s.cancelledAtStop && s.slot !== 'PP' && s.slot !== 'OPPP');
                const names = cancelledStops.map((s) => s.name || s.tpl).filter(Boolean);
                const summary = names.length === 0
                  ? 'Some calling points are not being served.'
                  : names.length <= 4
                    ? `Not calling at: ${names.join(', ')}.`
                    : `Not calling at ${names.length} stops including ${names.slice(0, 3).join(', ')}.`;
                const distinctReason = cancelledStops.find((s) => s.cancelReasonAtStop)?.cancelReasonAtStop?.reason;
                return (
                  <div className="svc-banner svc-banner--cancel">
                    <span className="svc-banner-label">Partial cancellation —</span> {summary}
                    {distinctReason && <> {distinctReason}</>}
                  </div>
                );
              })()}
              {!data.cancelled && !data.partiallyCancelled && data.delayReason && (
                <div className="svc-banner svc-banner--delay">
                  <span className="svc-banner-label">Delay reason —</span> {data.delayReason.reason}
                  {data.delayReason.code && <span className="svc-banner-code"> (code {data.delayReason.code})</span>}
                </div>
              )}

              {/* Service associations: joins (JJ), divides (VV), next portions (NP).
               * Each becomes a banner and a "View other portion" jump button so
               * the user can navigate to the related service detail page. */}
              {data.associations && data.associations.length > 0 && data.associations.map((a) => (
                <div key={`${a.category}-${a.otherRid}-${a.tiploc}`} className={`svc-banner svc-banner--assoc${a.isCancelled ? ' svc-banner--assoc-cancelled' : ''}`}>
                  <span className="svc-banner-label">
                    {a.category === 'VV' ? 'Splits' : a.category === 'JJ' ? 'Joins' : a.category === 'NP' ? 'Continues' : 'Associated'}
                    {a.isCancelled ? ' (cancelled)' : ''} —
                  </span>{' '}
                  {describeAssociation(a)}
                  <button
                    type="button"
                    className="svc-banner-link"
                    onClick={() => navigate(`/services/${encodeURIComponent(a.otherRid)}`)}
                  >View other portion →</button>
                </div>
              ))}

              {/* Per-service text alerts (e.g. SN bus replacement notes). */}
              {data.alerts && data.alerts.length > 0 && data.alerts.map((al) => (
                <div key={al.id} className="svc-banner svc-banner--alert">
                  <span className="svc-banner-label">Alert</span>
                  {al.source && <span className="svc-banner-source">{al.source}</span>}{' '}
                  {al.text}
                </div>
              ))}

              <div className="svc-summary-actions">
                <BUTWideButton
                  width="hug"
                  instantAction
                  colorVariant="primary"
                  onClick={refetch}
                >
                  Refresh
                </BUTWideButton>
              </div>
            </section>

            {/* Live formation + per-coach loading. Sits above the calling
             * pattern so passengers see coach information — typically the
             * thing they're trying to figure out at the platform — first.
             * Renders a muted placeholder note when no formation has been
             * published (most regional units don't broadcast it). */}
            <section className="svc-formation-section" aria-label="Coach formation and loading">
              <CarriageMap
                formation={data.formation}
                consist={data.consist}
                stops={data.stops}
                reverse={data.reverseFormation}
                initialTpl={data.origin}
              />
            </section>

            {/* Calling pattern */}
            <section className="svc-pattern-card" aria-label="Calling pattern">
              <h2 className="svc-pattern-title">Calling pattern</h2>
              <ol className="svc-stops">
                {data.stops.map((s, idx) => {
                  const kind = SLOT_KIND[s.slot] || 'stop'
                  const arr  = s.pta || trimSeconds(s.wta)
                  const dep  = s.ptd || trimSeconds(s.wtd)
                  const pass = s.wtp ? trimSeconds(s.wtp) : null
                  const showLive = !!s.liveTime && (s.liveKind === 'actual' || s.liveKind === 'est' || s.liveKind === 'actual-arr' || s.liveKind === 'est-arr')
                  const isLate = showLive && (
                    (s.liveKind?.startsWith('actual') && s.liveTime !== (dep || arr || pass)) ||
                    (s.liveKind?.startsWith('est')    && s.liveTime !== (dep || arr || pass))
                  )
                  return (
                    <li
                      key={`${s.tpl}-${idx}`}
                      className={[
                        'svc-stop',
                        `svc-stop--${kind}`,
                        s.cancelledAtStop ? 'svc-stop--cancelled' : '',
                        isLate ? 'svc-stop--late' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="svc-stop-marker" aria-hidden="true">
                        <span className="svc-stop-dot" />
                      </div>

                      <div className="svc-stop-times">
                        {kind === 'pass' ? (
                          <span className="svc-stop-time svc-stop-time--pass" title="Passing point">
                            <span className="svc-mono">{pass || '—'}</span>
                            <span className="svc-time-label">pass</span>
                          </span>
                        ) : (
                          <>
                            {arr ? (
                              <span className="svc-stop-time">
                                <span className="svc-mono">{arr}</span>
                                <span className="svc-time-label">arr</span>
                              </span>
                            ) : null}
                            {dep ? (
                              <span className="svc-stop-time">
                                <span className="svc-mono">{dep}</span>
                                <span className="svc-time-label">dep</span>
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>

                      <div className="svc-stop-name">
                        <span className="svc-stop-name-text">
                          {s.name || s.tpl}
                        </span>
                        {s.crs ? <span className="svc-stop-crs">{s.crs}</span> : null}
                        {kind === 'pass' ? (
                          <span className="svc-stop-meta-tag">passing</span>
                        ) : null}
                        {kind !== 'pass' && <ActivityPill activity={s.activity} />}
                      </div>

                      <div className="svc-stop-platform">
                        {s.livePlatform || s.platform ? (
                          <>
                            <span className="svc-stop-plat-label">Plat</span>
                            <span className="svc-mono svc-stop-plat-value">{s.livePlatform || s.platform}</span>
                          </>
                        ) : null}
                      </div>

                      <div className="svc-stop-live">
                        {s.cancelledAtStop && <span className="svc-pill svc-pill--cancelled">Cancelled</span>}
                        {!s.cancelledAtStop && showLive && s.liveKind === 'actual'      && <span className="svc-pill svc-pill--actual">Departed {s.liveTime}</span>}
                        {!s.cancelledAtStop && showLive && s.liveKind === 'actual-arr'  && <span className="svc-pill svc-pill--actual">Arrived {s.liveTime}</span>}
                        {!s.cancelledAtStop && showLive && s.liveKind === 'est'         && s.liveTime !== dep && <span className="svc-pill svc-pill--late">Exp {s.liveTime}</span>}
                        {!s.cancelledAtStop && showLive && s.liveKind === 'est-arr'     && <span className="svc-pill">Exp arr {s.liveTime}</span>}
                        {!s.cancelledAtStop && !showLive && kind !== 'pass' && (idx === 0 || idx === data.stops.length - 1) && (
                          <span className="svc-pill svc-pill--ontime">Scheduled</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>

            {/* Raw-data dump for debugging / power users. Collapsed by
             * default; expand to see every field the daemon returned for
             * this RID. Useful for spotting fields the UI hasn't surfaced
             * yet, or verifying which feed contributed which value. */}
            <RawDataDump data={data} />

            <footer className="svc-footer">
              <span>Source: Network Rail Darwin Push Port</span>
              <span className="svc-footer-sep" aria-hidden="true">·</span>
              <span>RID {data.rid}</span>
              <span className="svc-footer-sep" aria-hidden="true">·</span>
              <span>Updated {new Date(data.updatedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</span>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

export default ServiceDetailPage
