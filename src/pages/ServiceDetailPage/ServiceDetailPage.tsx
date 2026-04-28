import React, { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useServiceDetail } from '../../hooks/useServiceDetail'
import { PageTopHeader } from '../../components/misc'
import { BUTWideButton } from '../../components/buttons'
import './ServiceDetailPage.css'

const ACTIVITY_LABELS: Record<string, string> = {
  'TB':   'Train begins',
  'TF':   'Train terminates',
  'T':    'Stop',
  'T ':   'Stop',
  'T X':  'Set down only',
  'T D':  'Set down only',
  'T U':  'Pick up only',
  'OPRM': 'Operational stop',
}

const SLOT_KIND: Record<string, 'origin' | 'stop' | 'pass' | 'destination'> = {
  OR:   'origin', OPOR: 'origin',
  IP:   'stop',   OPIP: 'stop',
  PP:   'pass',   OPPP: 'pass',
  DT:   'destination', OPDT: 'destination',
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
                </div>
              )}
              {!data.cancelled && data.delayReason && (
                <div className="svc-banner svc-banner--delay">
                  <span className="svc-banner-label">Delay reason —</span> {data.delayReason.reason}
                </div>
              )}

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
                        {!s.cancelledAtStop && !showLive && kind !== 'pass' && (idx === 0 || idx === data.stops.length - 1 || s.activity) && (
                          <span className="svc-pill svc-pill--ontime">{ACTIVITY_LABELS[(s.activity || '').trim()] || 'Scheduled'}</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>

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
