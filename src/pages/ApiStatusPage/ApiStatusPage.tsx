import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PageTopHeader } from '../../components/misc'
import { BUTWideButton } from '../../components/buttons'
import './ApiStatusPage.css'

type HealthPayload = {
  ok: boolean
  timetableFile?: string
  loadedDate?: string
  memoryMB?: { heap?: number; rss?: number }
  kafka?: { consumed?: number; updates?: number; startedAt?: string; lastKafkaMsgAt?: string }
  ptac?: { enabled?: boolean; consumed?: number; matched?: number; unmatched?: number; errors?: number; lastMessageAt?: string }
  overlaySize?: { live?: number; formations?: number; consists?: number; units?: number; unmatchedConsists?: number }
  persistence?: { intervalSec?: number; lastPersistAt?: string }
  unitCatalog?: { size?: number; lastPersistAt?: string }
  history?: { retentionDays?: number; dates?: string[] }
}

type LogLevel = 'info' | 'warn' | 'success'
type ApiLog = { id: string; at: string; level: LogLevel; text: string }
type OverlaySeriesPoint = { savedAt: string; formations: number; consists: number; units: number }
type OverlaySeriesPayload = { hours: number; count: number; points: OverlaySeriesPoint[]; updatedAt: string }
type HistoryDatesPayload = {
  count: number
  retentionDays: number
  dates: Array<{
    date: string
    hasState: boolean
    hasTimetable: boolean
    snapshots: string[]
  }>
}

const API_STATUS_LOG_CACHE_KEY = 'api-status.logs.v1'

function formatNum(v: unknown): string {
  return typeof v === 'number' ? v.toLocaleString('en-GB') : '-'
}

function displayDateTime(isoLike: string): string {
  const d = new Date(isoLike)
  if (Number.isNaN(d.getTime())) return isoLike
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const ApiStatusPage: React.FC = () => {
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<ApiLog[]>([])
  const [series, setSeries] = useState<OverlaySeriesPayload | null>(null)
  const [liveSeries, setLiveSeries] = useState<OverlaySeriesPoint[]>([])
  const [available, setAvailable] = useState<HistoryDatesPayload | null>(null)
  const prevRef = useRef<HealthPayload | null>(null)

  const appendLog = (level: LogLevel, text: string, atOverride?: string) => {
    const entry: ApiLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: atOverride || displayDateTime(new Date().toISOString()),
      level,
      text,
    }
    setLogs((curr) => [entry, ...curr])
  }

  const runFetch = async (isInitial = false) => {
    if (isInitial) setStatus('loading')
    try {
      const res = await fetch('/api/darwin/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const next: HealthPayload = await res.json()
      setHealth(next)
      setStatus('ok')
      setError(null)
      if (
        typeof next.overlaySize?.formations === 'number' &&
        typeof next.overlaySize?.consists === 'number' &&
        typeof next.overlaySize?.units === 'number'
      ) {
        const point: OverlaySeriesPoint = {
          savedAt: new Date().toISOString(),
          formations: next.overlaySize.formations,
          consists: next.overlaySize.consists,
          units: next.overlaySize.units,
        }
        setLiveSeries((curr) => {
          const last = curr[curr.length - 1]
          if (
            last &&
            last.formations === point.formations &&
            last.consists === point.consists &&
            last.units === point.units
          ) return curr
          return [...curr, point].slice(-240)
        })
      }

      const prev = prevRef.current
      if (!prev) {
        appendLog('success', `Connected to API health. Timetable: ${next.timetableFile || 'unknown'}`)
      } else {
        const prevKafka = prev.kafka?.consumed ?? 0
        const nextKafka = next.kafka?.consumed ?? 0
        const deltaKafka = nextKafka - prevKafka

        const prevForms = prev.overlaySize?.formations ?? 0
        const nextForms = next.overlaySize?.formations ?? 0
        const deltaForms = nextForms - prevForms

        if (deltaKafka > 0) appendLog('info', `Kafka +${deltaKafka.toLocaleString('en-GB')} messages`)
        if (deltaForms > 0) appendLog('success', `Formations ${prevForms.toLocaleString('en-GB')} -> ${nextForms.toLocaleString('en-GB')} (+${deltaForms.toLocaleString('en-GB')})`)
        const prevConsists = prev.overlaySize?.consists ?? 0
        const nextConsists = next.overlaySize?.consists ?? 0
        const deltaConsists = nextConsists - prevConsists
        if (deltaConsists > 0) appendLog('success', `Consists ${prevConsists.toLocaleString('en-GB')} -> ${nextConsists.toLocaleString('en-GB')} (+${deltaConsists.toLocaleString('en-GB')})`)
        const prevUnits = prev.overlaySize?.units ?? 0
        const nextUnits = next.overlaySize?.units ?? 0
        const deltaUnits = nextUnits - prevUnits
        if (deltaUnits > 0) appendLog('success', `Units ${prevUnits.toLocaleString('en-GB')} -> ${nextUnits.toLocaleString('en-GB')} (+${deltaUnits.toLocaleString('en-GB')})`)
        if ((next.ptac?.errors ?? 0) > (prev.ptac?.errors ?? 0)) appendLog('warn', 'PTAC error count increased')
      }
      prevRef.current = next
    } catch (e) {
      setStatus('error')
      const msg = (e as Error)?.message || 'Failed to load health.'
      setError(msg)
      appendLog('warn', `Health fetch failed: ${msg}`)
    }
  }

  const fetchSeries = async () => {
    try {
      const res = await fetch('/api/darwin/history/overlay-series?hours=36')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload: OverlaySeriesPayload = await res.json()
      setSeries(payload)
    } catch {}
  }

  const fetchAvailable = async () => {
    try {
      const res = await fetch('/api/darwin/history/dates')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload: HistoryDatesPayload = await res.json()
      setAvailable(payload)
    } catch {}
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(API_STATUS_LOG_CACHE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const cleaned = parsed
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({
          id: String(x.id || ''),
          at: String(x.at || ''),
          level: (x.level === 'warn' || x.level === 'success' || x.level === 'info') ? x.level : 'info',
          text: String(x.text || ''),
        }))
        .filter((x) => x.id && x.at && x.text)
      if (cleaned.length > 0) setLogs(cleaned)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(API_STATUS_LOG_CACHE_KEY, JSON.stringify(logs))
    } catch {}
  }, [logs])

  useEffect(() => {
    if (!series?.points?.length) return
    setLogs((curr) => {
      if (curr.length > 0) return curr
      const points = series.points
      const generated: ApiLog[] = []
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const next = points[i]
        const df = next.formations - prev.formations
        const dc = next.consists - prev.consists
        const du = next.units - prev.units
        if (df > 0) {
          generated.push({
            id: `hist-f-${next.savedAt}-${i}`,
            at: displayDateTime(next.savedAt),
            level: 'success',
            text: `Formations ${prev.formations.toLocaleString('en-GB')} -> ${next.formations.toLocaleString('en-GB')} (+${df.toLocaleString('en-GB')})`,
          })
        }
        if (dc > 0) {
          generated.push({
            id: `hist-c-${next.savedAt}-${i}`,
            at: displayDateTime(next.savedAt),
            level: 'success',
            text: `Consists ${prev.consists.toLocaleString('en-GB')} -> ${next.consists.toLocaleString('en-GB')} (+${dc.toLocaleString('en-GB')})`,
          })
        }
        if (du > 0) {
          generated.push({
            id: `hist-u-${next.savedAt}-${i}`,
            at: displayDateTime(next.savedAt),
            level: 'success',
            text: `Units ${prev.units.toLocaleString('en-GB')} -> ${next.units.toLocaleString('en-GB')} (+${du.toLocaleString('en-GB')})`,
          })
        }
      }
      return generated.reverse()
    })
  }, [series])

  useEffect(() => {
    runFetch(true)
    fetchSeries()
    fetchAvailable()
    const t = window.setInterval(() => void runFetch(false), 15000)
    const s = window.setInterval(() => void fetchSeries(), 60000)
    const a = window.setInterval(() => void fetchAvailable(), 120000)
    return () => {
      window.clearInterval(t)
      window.clearInterval(s)
      window.clearInterval(a)
    }
  }, [])

  const summary = useMemo(() => ({
    timetable: health?.timetableFile || '-',
    loadedDate: health?.loadedDate || '-',
    kafkaConsumed: formatNum(health?.kafka?.consumed),
    kafkaUpdates: formatNum(health?.kafka?.updates),
    formations: formatNum(health?.overlaySize?.formations),
    consists: formatNum(health?.overlaySize?.consists),
    units: formatNum(health?.overlaySize?.units),
    unitCatalog: formatNum(health?.unitCatalog?.size),
    heap: formatNum(health?.memoryMB?.heap),
    rss: formatNum(health?.memoryMB?.rss),
    persistEvery: `${formatNum(health?.persistence?.intervalSec)}s`,
    lastPersist: health?.persistence?.lastPersistAt || '-',
    ptac: health?.ptac?.enabled ? 'Enabled' : 'Disabled',
  }), [health])

  const chart = useMemo(() => {
    const points = (series?.points && series.points.length > 0) ? series.points : liveSeries
    if (points.length < 2) return null
    const width = 860
    const height = 240
    const pad = { l: 44, r: 16, t: 16, b: 28 }
    const maxY = Math.max(1, ...points.map((p) => Math.max(p.formations, p.consists, p.units)))
    const minT = new Date(points[0].savedAt).getTime()
    const maxT = new Date(points[points.length - 1].savedAt).getTime()
    const spanT = Math.max(1, maxT - minT)
    const x = (ms: number) => pad.l + ((ms - minT) / spanT) * (width - pad.l - pad.r)
    const y = (v: number) => height - pad.b - (v / maxY) * (height - pad.t - pad.b)
    const linePath = (pick: (p: OverlaySeriesPoint) => number) => points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(new Date(p.savedAt).getTime()).toFixed(2)},${y(pick(p)).toFixed(2)}`)
      .join(' ')
    return {
      width,
      height,
      yTicks: [0, Math.round(maxY * 0.25), Math.round(maxY * 0.5), Math.round(maxY * 0.75), maxY],
      pathFormations: linePath((p) => p.formations),
      pathConsists: linePath((p) => p.consists),
      pathUnits: linePath((p) => p.units),
      xLeftLabel: new Date(points[0].savedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      xRightLabel: new Date(points[points.length - 1].savedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      yPos: y,
      pad,
    }
  }, [series, liveSeries])

  const displayPoints = useMemo(
    () => ((series?.points && series.points.length > 0) ? series.points : liveSeries),
    [series, liveSeries]
  )

  return (
    <div className="api-status-shell">
      <PageTopHeader
        title="API Status"
        subtitle={status === 'ok' ? 'Live Darwin daemon health and cache telemetry' : 'Connecting to API health...'}
      />
      <div className="api-status-page">
        <section className="api-status-controls">
          <BUTWideButton width="hug" instantAction onClick={() => void runFetch(false)}>
            Refresh now
          </BUTWideButton>
          {status === 'error' && <p className="api-status-error">{error}</p>}
        </section>

        <section className="api-status-grid" aria-label="API health summary">
          <article className="api-status-card"><h3>Timetable</h3><p>{summary.timetable}</p></article>
          <article className="api-status-card"><h3>Loaded date</h3><p>{summary.loadedDate}</p></article>
          <article className="api-status-card"><h3>Kafka consumed</h3><p>{summary.kafkaConsumed}</p></article>
          <article className="api-status-card"><h3>Kafka updates</h3><p>{summary.kafkaUpdates}</p></article>
          <article className="api-status-card"><h3>Formations</h3><p>{summary.formations}</p></article>
          <article className="api-status-card"><h3>Consists</h3><p>{summary.consists}</p></article>
          <article className="api-status-card"><h3>Units</h3><p>{summary.units}</p></article>
          <article className="api-status-card"><h3>Unit catalog</h3><p>{summary.unitCatalog}</p></article>
          <article className="api-status-card"><h3>PTAC</h3><p>{summary.ptac}</p></article>
          <article className="api-status-card"><h3>Heap MB</h3><p>{summary.heap}</p></article>
          <article className="api-status-card"><h3>RSS MB</h3><p>{summary.rss}</p></article>
          <article className="api-status-card"><h3>Persist</h3><p>{summary.persistEvery} · {summary.lastPersist}</p></article>
        </section>

        <section className="api-log-card" aria-label="Stylised API logs">
          <h2>Live Event Logs</h2>
          <div className="api-log-list">
            {logs.length === 0 ? (
              <p className="api-log-empty">Waiting for events...</p>
            ) : logs.map((log) => (
              <article key={log.id} className={`api-log-item api-log-item--${log.level}`}>
                <span className="api-log-time">{log.at}</span>
                <span className="api-log-text">{log.text}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="api-log-card" aria-label="Overlay cache trend chart">
          <h2>Cache Trend (36h)</h2>
          <p className="api-log-empty">
            {series?.points?.length
              ? 'Formations, Consists, Units from persisted cache snapshots.'
              : 'No persisted snapshot series yet — showing live polled values captured in this page session.'}
          </p>
          {!chart && <p className="api-log-empty">Not enough history yet to render graph. Showing available points as text:</p>}
          {chart && (
            <div className="api-chart-wrap">
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="api-chart" role="img" aria-label="Overlay cache trend chart">
                {chart.yTicks.map((tick) => (
                  <g key={`tick-${tick}`}>
                    <line x1={chart.pad.l} x2={chart.width - chart.pad.r} y1={chart.yPos(tick)} y2={chart.yPos(tick)} className="api-chart-grid" />
                    <text x={chart.pad.l - 8} y={chart.yPos(tick) + 4} className="api-chart-axis-label">{tick}</text>
                  </g>
                ))}
                <path d={chart.pathFormations} className="api-chart-line api-chart-line--formations" />
                <path d={chart.pathConsists} className="api-chart-line api-chart-line--consists" />
                <path d={chart.pathUnits} className="api-chart-line api-chart-line--units" />
                <text x={chart.pad.l} y={chart.height - 8} className="api-chart-axis-label">{chart.xLeftLabel}</text>
                <text x={chart.width - chart.pad.r} y={chart.height - 8} textAnchor="end" className="api-chart-axis-label">{chart.xRightLabel}</text>
              </svg>
              <div className="api-chart-legend">
                <span><i className="api-dot api-dot--formations" /> Formations</span>
                <span><i className="api-dot api-dot--consists" /> Consists</span>
                <span><i className="api-dot api-dot--units" /> Units</span>
              </div>
            </div>
          )}
          <div className="api-series-text">
            {displayPoints.length === 0 ? (
              <p className="api-log-empty">No persisted points available yet.</p>
            ) : (
              displayPoints
                .slice(-12)
                .reverse()
                .map((p) => (
                  <article key={p.savedAt} className="api-series-text-item">
                    <span className="api-series-time">
                      {new Date(p.savedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="api-series-values">
                      F {formatNum(p.formations)} · C {formatNum(p.consists)} · U {formatNum(p.units)}
                    </span>
                  </article>
                ))
            )}
          </div>
        </section>

        <section className="api-log-card" aria-label="Overlay history text values">
          <h2>Overlay History (text)</h2>
          <p className="api-log-empty">
            {series?.points?.length
              ? 'Cached snapshot values from the API history store (latest first).'
              : 'Live values captured during this session (latest first).'}
          </p>
          <div className="api-overlay-history-list">
            {displayPoints.length === 0 ? (
              <p className="api-log-empty">No overlay history points available yet.</p>
            ) : (
              displayPoints
                .slice()
                .reverse()
                .slice(0, 60)
                .map((p, idx) => (
                  <article key={`${p.savedAt}-${idx}`} className="api-overlay-history-item">
                    <span className="api-overlay-history-time">{displayDateTime(p.savedAt)}</span>
                    <span className="api-overlay-history-value">F {formatNum(p.formations)}</span>
                    <span className="api-overlay-history-value">C {formatNum(p.consists)}</span>
                    <span className="api-overlay-history-value">U {formatNum(p.units)}</span>
                  </article>
                ))
            )}
          </div>
        </section>

        <section className="api-log-card" aria-label="Available historical data">
          <h2>Available Data</h2>
          <p className="api-log-empty">
            {available
              ? `${available.count} date(s) · retention ${available.retentionDays} days`
              : 'Loading available history dates...'}
          </p>
          <div className="api-available-list">
            {(available?.dates || []).slice(0, 10).map((d) => (
              <article key={d.date} className="api-available-item">
                <div>
                  <strong>{d.date}</strong>
                  <div className="api-available-meta">
                    <span>state: {d.hasState ? 'yes' : 'no'}</span>
                    <span>timetable: {d.hasTimetable ? 'yes' : 'no'}</span>
                    <span>snapshots: {d.snapshots.length}</span>
                  </div>
                </div>
                <span className="api-available-last">
                  {d.snapshots.length > 0
                    ? new Date(d.snapshots[d.snapshots.length - 1]).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default ApiStatusPage
