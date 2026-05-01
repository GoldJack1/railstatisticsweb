import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
const SLOT_KIND_LABEL: Record<'origin' | 'stop' | 'pass' | 'destination', string> = {
  origin: 'Origin',
  stop: 'Calling',
  pass: 'Passing',
  destination: 'Destination',
}
type ViewMode = 'detailed' | 'simple'

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

function formatDateOnly(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isRawTiplocName(name: string | null | undefined, tpl: string): boolean {
  if (!name) return true
  return name.trim().toUpperCase() === tpl.trim().toUpperCase()
}

function displayStopName(
  stops: NonNullable<ServiceDetail['stops']>,
  idx: number
): string {
  const stop = stops[idx]
  if (!stop) return ''
  const current = stop.name?.trim()
  if (current && !isRawTiplocName(current, stop.tpl)) return current
  if (stop.slot === 'PP' || stop.slot === 'OPPP') return 'Passing point'
  return stop.tpl
}

function isScheduleDeactivatedReason(reason: string | null | undefined): boolean {
  if (!reason) return false
  return reason.trim().toLowerCase().includes('schedule deactivated')
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
  const qp = new URLSearchParams()
  if (data.historicalDate) qp.set('date', data.historicalDate)
  if (data.historicalAt) qp.set('at', data.historicalAt)
  const apiUrl = `/api/darwin/service/${encodeURIComponent(data.rid)}${qp.toString() ? `?${qp.toString()}` : ''}`
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
  const location = useLocation()
  const navigate = useNavigate()
  const rid = params.rid || ''
  const [viewMode, setViewMode] = useState<ViewMode>('detailed')

  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const historicalDate = query.get('date') || undefined
  const historicalAt = query.get('at') || undefined
  const from = query.get('from') || ''
  const historicalMode = !!historicalDate

  const { status, data, error, ageMs, refetch } = useServiceDetail({
    rid,
    date: historicalDate,
    at: historicalAt,
    pollMs: historicalMode ? 0 : 15_000,
  })

  const title = useMemo(() => {
    if (!data) return rid
    const dest = data.destinationName || data.destination
    return `${data.trainId} · ${data.originName || data.origin} → ${dest}`
  }, [data, rid])

  const subtitle = useMemo(() => {
    const serviceDate = data?.ssd ? formatDateOnly(data.ssd) : null
    const histDate = data?.historicalDate ? formatDateOnly(data.historicalDate) : null
    const dateText = histDate
      ? `Service date ${serviceDate || '—'} · Viewing ${histDate}`
      : serviceDate
        ? `Service date ${serviceDate}`
        : ''
    if (status === 'ok')        return `${historicalMode ? 'Historical snapshot' : `Live · updated ${formatAge(ageMs)}`}${dateText ? `\n${dateText}` : ''}`
    if (status === 'stale')     return `${historicalMode ? 'Historical snapshot' : `Stale · ${formatAge(ageMs)}`}${dateText ? `\n${dateText}` : ''}`
    if (status === 'loading')   return `Loading service detail…${dateText ? `\n${dateText}` : ''}`
    if (status === 'error')     return error ? `Error: ${error}` : 'Service unavailable'
    if (status === 'not-found') return 'Service not found'
    return dateText
  }, [status, error, ageMs, historicalMode, data])

  return (
    <div className="service-detail-shell">
      <PageTopHeader
        title={title}
        subtitle={subtitle}
        className={`service-detail-header service-detail-header--${status}`}
        actionButton={{
          label: '← Back',
          onClick: () => {
            if (from) { navigate(from); return }
            if (window.history.length > 1) { navigate(-1); return }
            navigate('/departures')
          },
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
            <section className="svc-viewmode-card" aria-label="View mode">
              <div className="svc-viewmode-toggle" role="tablist" aria-label="Service detail view mode">
                <button
                  type="button"
                  className={`svc-viewmode-btn${viewMode === 'detailed' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('detailed')}
                  aria-pressed={viewMode === 'detailed'}
                >
                  Detailed
                </button>
                <button
                  type="button"
                  className={`svc-viewmode-btn${viewMode === 'simple' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('simple')}
                  aria-pressed={viewMode === 'simple'}
                >
                  Simple
                </button>
              </div>
            </section>

            <section
              className={`svc-summary-card ${data.cancelled ? 'svc-summary-card--cancelled' : ''}`}
              aria-label="Service summary"
            >
              <div className="svc-summary-grid">
                {viewMode === 'detailed' && (
                  <div className="svc-summary-item">
                    <span className="svc-summary-label">Operator</span>
                    <span className="svc-summary-value">{data.tocName || data.toc}</span>
                  </div>
                )}
                {viewMode === 'detailed' && (
                  <div className="svc-summary-item">
                    <span className="svc-summary-label">Headcode</span>
                    <span className="svc-summary-value svc-mono">{data.trainId}</span>
                  </div>
                )}
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
                {viewMode === 'detailed' && (
                  <div className="svc-summary-item">
                    <span className="svc-summary-label">Stops</span>
                    <span className="svc-summary-value svc-mono">{data.stops.filter(s => SLOT_KIND[s.slot] !== 'pass').length}</span>
                  </div>
                )}
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
                  {isScheduleDeactivatedReason(data.cancellation.reason) ? (
                    <span className="svc-banner-label">Cancelled</span>
                  ) : (
                    <>
                      <span className="svc-banner-label">Cancelled —</span> {data.cancellation.reason}
                      {data.cancellation.code && <span className="svc-banner-code"> (code {data.cancellation.code})</span>}
                    </>
                  )}
                </div>
              )}
              {!data.cancelled && data.partiallyCancelled && (() => {
                const cancelledStops = data.stops.filter((s) => s.cancelledAtStop && s.slot !== 'PP' && s.slot !== 'OPPP');
                const names = cancelledStops.map((s) => {
                  const i = data.stops.findIndex((x) => x.tpl === s.tpl && x.slot === s.slot)
                  return i >= 0 ? displayStopName(data.stops, i) : (s.name || s.tpl)
                }).filter(Boolean);
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
                    onClick={() => {
                      const next = new URLSearchParams()
                      if (historicalDate) next.set('date', historicalDate)
                      if (historicalAt) next.set('at', historicalAt)
                      if (from) next.set('from', from)
                      navigate(`/services/${encodeURIComponent(a.otherRid)}${next.toString() ? `?${next.toString()}` : ''}`)
                    }}
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
              <div className="svc-table-wrap">
                <table className="svc-stops-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Location</th>
                      {viewMode === 'detailed' && <th>PTA</th>}
                      {viewMode === 'detailed' && <th>PTD</th>}
                      <th>WTA</th>
                      <th>WTD/WTP</th>
                      <th>Platform</th>
                      <th>Live</th>
                    </tr>
                  </thead>
                  <tbody>
                {data.stops.map((s, idx) => {
                  const stopLabel = displayStopName(data.stops, idx)
                  if (stopLabel === 'Passing point') return null
                  const kind = SLOT_KIND[s.slot] || 'stop'
                  if (viewMode === 'simple' && kind === 'pass') return null
                  const kindLabel = SLOT_KIND_LABEL[kind]
                  const pArr = s.pta || null
                  const pDep = s.ptd || null
                  const wArr = trimSeconds(s.wta) || null
                  const wDep = trimSeconds(s.wtd) || null
                  const wPass = s.wtp ? trimSeconds(s.wtp) : null
                  const showLive = !!s.liveTime && (s.liveKind === 'actual' || s.liveKind === 'est' || s.liveKind === 'actual-arr' || s.liveKind === 'est-arr')
                  const isLate = showLive && (
                    (s.liveKind?.startsWith('actual') && s.liveTime !== (pDep || pArr || wPass || wDep || wArr)) ||
                    (s.liveKind?.startsWith('est')    && s.liveTime !== (pDep || pArr || wPass || wDep || wArr))
                  )
                  return (
                    <tr
                      key={`${s.tpl}-${idx}`}
                      className={[
                        'svc-stop',
                        `svc-stop--${kind}`,
                        s.cancelledAtStop ? 'svc-stop--cancelled' : '',
                        isLate ? 'svc-stop--late' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <td><span className={`svc-kind-badge svc-kind-badge--${kind}`}>{kindLabel}</span></td>
                      <td>
                        <div className="svc-stop-name">
                          <span className="svc-stop-name-text">{stopLabel}</span>
                          {s.crs ? <span className="svc-stop-crs">{s.crs}</span> : null}
                          {kind !== 'pass' && <ActivityPill activity={s.activity} />}
                        </div>
                      </td>
                      {viewMode === 'detailed' && <td className="svc-mono">{kind === 'pass' ? '—' : (pArr || '—')}</td>}
                      {viewMode === 'detailed' && <td className="svc-mono">{kind === 'pass' ? '—' : (pDep || '—')}</td>}
                      <td className="svc-mono">{kind === 'pass' ? '—' : (wArr || '—')}</td>
                      <td className="svc-mono">{kind === 'pass' ? (wPass || '—') : (wDep || '—')}</td>
                      <td className="svc-mono">{s.livePlatform || s.platform || '—'}</td>
                      <td>
                        <div className="svc-stop-live">
                          {s.cancelledAtStop && <span className="svc-pill svc-pill--cancelled">Cancelled</span>}
                          {!s.cancelledAtStop && showLive && s.liveKind === 'actual'      && <span className="svc-pill svc-pill--actual">Departed {s.liveTime}</span>}
                          {!s.cancelledAtStop && showLive && s.liveKind === 'actual-arr'  && <span className="svc-pill svc-pill--actual">Arrived {s.liveTime}</span>}
                          {!s.cancelledAtStop && showLive && s.liveKind === 'est'         && s.liveTime !== pDep && <span className="svc-pill svc-pill--late">Expected {s.liveTime}</span>}
                          {!s.cancelledAtStop && showLive && s.liveKind === 'est-arr'     && <span className="svc-pill">Expected arr {s.liveTime}</span>}
                          {!s.cancelledAtStop && !showLive && kind !== 'pass' && (idx === 0 || idx === data.stops.length - 1) && !data.historicalDate && (
                            <span className="svc-pill svc-pill--ontime">Scheduled</span>
                          )}
                          {!s.cancelledAtStop && !showLive && kind !== 'pass' && data.historicalDate && (
                            <span className="svc-pill">---</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                  </tbody>
                </table>
              </div>
            </section>

            {data.consist?.allocations?.length ? (() => {
              type VehicleType = NonNullable<ServiceDetail['consist']>['allocations'][number]['resourceGroups'][number]['vehicles'][number]
              const unitMap = new Map<string, {
                unitKey: string
                unitId: string | null
                fleetId: string | null
                resourceType: string | null
                unitStatus: string | null
                endOfDayMiles: number | null
                reversed: boolean
                vehicles: VehicleType[]
              }>()

              data.consist.allocations.forEach((a) => {
                (a.resourceGroups || []).forEach((g, groupIdx) => {
                  const unitKey = `unit-${g.unitId || 'unknown'}-${g.fleetId || 'unknown'}-${groupIdx}`
                  const existing = unitMap.get(unitKey)
                  if (!existing) {
                    unitMap.set(unitKey, {
                      unitKey,
                      unitId: g.unitId || null,
                      fleetId: g.fleetId || null,
                      resourceType: g.typeOfResourceLabel || g.typeOfResource || null,
                      unitStatus: g.status || null,
                      endOfDayMiles: g.endOfDayMiles ?? null,
                      reversed: !!a.reversed,
                      vehicles: [...(g.vehicles || [])],
                    })
                  } else {
                    const seen = new Set(existing.vehicles.map((v) => `${v.vehicleId || ''}-${v.position ?? ''}`))
                    for (const v of g.vehicles || []) {
                      const vk = `${v.vehicleId || ''}-${v.position ?? ''}`
                      if (!seen.has(vk)) {
                        existing.vehicles.push(v)
                        seen.add(vk)
                      }
                    }
                  }
                })
              })

              const units = [...unitMap.values()]
              if (units.length === 0) return null
              return (
                <details className="svc-collapsible-card svc-vehicle-card" aria-label="Vehicle details and logs" open>
                  <summary className="svc-collapsible-summary">
                    <span className="svc-pattern-title">Vehicle details & logs</span>
                    <span className="svc-collapsible-hint">show or hide</span>
                  </summary>
                  <p className="svc-allocation-subtitle">Grouped by unit, then one section per vehicle.</p>
                  <div className="svc-vehicle-list">
                    {units.map((unit) => {
                      const sortedVehicles = unit.vehicles
                        .slice()
                        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                      const renderAllocationField = (
                        label: string,
                        value: string | number | null | undefined,
                        opts?: { fullWidth?: boolean }
                      ) => {
                        if (value == null) return null
                        const text = String(value).trim()
                        if (!text || text === '—') return null
                        return (
                          <div className={`svc-allocation-field${opts?.fullWidth ? ' svc-allocation-field--block' : ''}`}>
                            <span className="svc-allocation-label">{label}</span>
                            <span className="svc-allocation-value">{text}</span>
                          </div>
                        )
                      }
                      const sharedFrom = (pick: (v: typeof sortedVehicles[number]) => string | null) => {
                        if (sortedVehicles.length === 0) return null
                        const first = pick(sortedVehicles[0])
                        if (!first) return null
                        return sortedVehicles.every((v) => pick(v) === first) ? first : null
                      }
                      const shared = {
                        specificType: sharedFrom((v) => v.specificType || null),
                        vehicleType: sharedFrom((v) => v.typeOfVehicle || null),
                        plannedGroup: sharedFrom((v) => v.plannedGroupId || null),
                        cabs: sharedFrom((v) => (v.cabs != null ? String(v.cabs) : null)),
                        maxSpeed: sharedFrom((v) => (v.maximumSpeedMph != null ? `${v.maximumSpeedMph} mph` : null)),
                        restrictiveSpeed: sharedFrom((v) => (v.restrictiveMaximumSpeedMph != null ? `${v.restrictiveMaximumSpeedMph} mph` : null)),
                        brakeType: sharedFrom((v) => v.trainBrakeTypeLabel || v.trainBrakeType || null),
                        status: sharedFrom((v) => v.vehicleStatus || null),
                        category: sharedFrom((v) => v.registeredCategoryLabel || v.registeredCategory || null),
                        special: sharedFrom((v) => v.specialCharacteristics || null),
                        liveryDecor: sharedFrom((v) => ([v.livery, v.decor].filter(Boolean).join(' · ') || null)),
                        entered: sharedFrom((v) => v.dateEnteredService || null),
                      }
                      const enteredByDate = new Map<string, string[]>()
                      for (const v of sortedVehicles) {
                        const date = v.dateEnteredService || 'Unknown date'
                        const label = v.vehicleId || `Pos ${v.position ?? '—'}`
                        const arr = enteredByDate.get(date) || []
                        arr.push(label)
                        enteredByDate.set(date, arr)
                      }
                      const enteredSummary = shared.entered
                        ? formatDateOnly(shared.entered)
                        : [...enteredByDate.entries()]
                            .map(([date, vehicles]) => `${formatDateOnly(date)}: ${vehicles.join(', ')}`)
                            .join(' | ')
                      return (
                      <article key={unit.unitKey} className="svc-unit-item">
                        <header className="svc-vehicle-head">
                          <h3 className="svc-vehicle-title">Unit {unit.unitId || 'Unknown'}</h3>
                        </header>
                        <div className="svc-unit-shared">
                          <h4 className="svc-vehicle-logs-title">Whole unit (shared details)</h4>
                          <div className="svc-allocation-grid">
                            {renderAllocationField('Fleet', unit.fleetId)}
                            {renderAllocationField('Resource type', unit.resourceType)}
                            {renderAllocationField('Unit status', unit.unitStatus)}
                            {renderAllocationField('End-of-day miles', unit.endOfDayMiles)}
                            {renderAllocationField('Vehicle count', unit.vehicles.length)}
                            {unit.reversed ? renderAllocationField('Formation direction', 'Reversed') : null}
                            {renderAllocationField('Specific type', shared.specificType)}
                            {renderAllocationField('Vehicle type', shared.vehicleType)}
                            {renderAllocationField('Planned group', shared.plannedGroup)}
                            {renderAllocationField('Cabs', shared.cabs)}
                            {renderAllocationField('Max speed', shared.maxSpeed)}
                            {renderAllocationField('Restrictive max speed', shared.restrictiveSpeed)}
                            {renderAllocationField('Brake type', shared.brakeType)}
                            {renderAllocationField('Status', shared.status)}
                            {renderAllocationField('Category', shared.category)}
                            {renderAllocationField('Special characteristics', shared.special)}
                            {renderAllocationField('Livery / decor', shared.liveryDecor)}
                            {renderAllocationField('Date entered service', enteredSummary, { fullWidth: true })}
                          </div>
                        </div>
                        <div className="svc-unit-vehicles">
                          {sortedVehicles.map((v, vehicleIdx) => {
                              const defects = v.defects || []
                              const specificType = shared.specificType ? null : (v.specificType || null)
                              const vehicleType = shared.vehicleType ? null : (v.typeOfVehicle || null)
                              const plannedGroup = shared.plannedGroup ? null : (v.plannedGroupId || null)
                              const seats = v.numberOfSeats ?? null
                              const cabs = shared.cabs ? null : (v.cabs ?? null)
                              const maxSpeed = shared.maxSpeed ? null : (v.maximumSpeedMph != null ? `${v.maximumSpeedMph} mph` : null)
                              const restrictiveMaxSpeed = shared.restrictiveSpeed ? null : (v.restrictiveMaximumSpeedMph != null ? `${v.restrictiveMaximumSpeedMph} mph` : null)
                              const brakeType = shared.brakeType ? null : (v.trainBrakeTypeLabel || v.trainBrakeType || null)
                              const status = shared.status ? null : (v.vehicleStatus || null)
                              const category = shared.category ? null : (v.registeredCategoryLabel || v.registeredCategory || null)
                              const lengthWeight = (v.lengthMm != null || v.weightTonnes != null)
                                ? `${v.lengthMm != null ? `${v.lengthMm} mm` : '—'} / ${v.weightTonnes != null ? `${v.weightTonnes} t` : '—'}`
                                : null
                              const special = shared.special ? null : (v.specialCharacteristics || null)
                              const liveryDecor = shared.liveryDecor ? null : ([v.livery, v.decor].filter(Boolean).join(' · ') || null)
                              const vehicleName = v.vehicleName || null
                              const enteredService = shared.entered
                                ? null
                                : (v.dateEnteredService ? formatDateOnly(v.dateEnteredService) : null)
                              const radioNumbers = [v.radioNumberA, v.radioNumberB].filter(Boolean).join(' / ') || null
                              return (
                                <article key={`${unit.unitKey}-v-${v.vehicleId || vehicleIdx}`} className="svc-vehicle-item">
                                  <header className="svc-vehicle-head">
                                    <h4 className="svc-vehicle-title">{v.vehicleId || `Vehicle ${v.position ?? '—'}`}</h4>
                                    <div className="svc-allocation-tags">
                                      {v.position != null && <span className="svc-allocation-tag">Pos {v.position}</span>}
                                      {defects.length > 0 && <span className="svc-allocation-tag svc-allocation-tag--warn">{defects.length} log{defects.length === 1 ? '' : 's'}</span>}
                                    </div>
                                  </header>
                                  <div className="svc-allocation-grid">
                                    {renderAllocationField('Specific type', specificType)}
                                    {renderAllocationField('Vehicle type', vehicleType)}
                                    {renderAllocationField('Planned group', plannedGroup)}
                                    {renderAllocationField('Seats', seats)}
                                    {renderAllocationField('Cabs', cabs)}
                                    {renderAllocationField('Max speed', maxSpeed)}
                                    {renderAllocationField('Restrictive max speed', restrictiveMaxSpeed)}
                                    {renderAllocationField('Brake type', brakeType)}
                                    {renderAllocationField('Status', status)}
                                    {renderAllocationField('Category', category)}
                                    {renderAllocationField('Length / weight', lengthWeight)}
                                    {renderAllocationField('Special characteristics', special)}
                                    {renderAllocationField('Livery / decor', liveryDecor)}
                                    {renderAllocationField('Vehicle name', vehicleName)}
                                    {renderAllocationField('Date entered service', enteredService)}
                                    {renderAllocationField('Radio numbers', radioNumbers)}
                                  </div>
                                  {defects.length > 0 ? (
                                    <div className="svc-vehicle-logs">
                                      <h4 className="svc-vehicle-logs-title">Logs</h4>
                                      <ul className="svc-vehicle-log-list">
                                        {defects.map((d, dIdx) => (
                                          <li key={`${unit.unitKey}-${v.vehicleId || vehicleIdx}-d-${dIdx}`} className="svc-vehicle-log-item">
                                            <span className="svc-vehicle-log-main">
                                              {d.code || 'No code'} — {d.description || 'No description'}
                                            </span>
                                            <span className="svc-vehicle-log-meta">
                                              {d.statusLabel || d.status || 'Unknown status'}
                                              {d.location ? ` · ${d.location}` : ''}
                                              {d.maintenanceUid ? ` · ${d.maintenanceUid}` : ''}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : (
                                    <p className="svc-vehicle-no-logs">No logs for this vehicle.</p>
                                  )}
                                </article>
                              )
                            })}
                        </div>
                      </article>
                    )})}
                  </div>
                </details>
              )
            })() : null}

            {/* Raw-data dump for debugging / power users. Collapsed by
             * default; expand to see every field the daemon returned for
             * this RID. Useful for spotting fields the UI hasn't surfaced
             * yet, or verifying which feed contributed which value. */}
            {viewMode === 'detailed' && <RawDataDump data={data} />}

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
