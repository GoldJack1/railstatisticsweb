import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeparturesSnapshot } from '../types/darwin'

export type DeparturesStatus =
  | 'idle'
  | 'loading'         // initial fetch in flight, no data yet
  | 'ok'              // fresh data, < STALE_AFTER_MS old
  | 'stale'           // data exists but updatedAt is too old (daemon may be down)
  | 'error'           // latest fetch failed
  | 'not-found'       // station code returned 404

export interface UseDeparturesOptions {
  /** CRS or TIPLOC. Empty string disables fetching. */
  code: string
  /** Look-ahead window passed to the daemon. */
  hours?: number
  /** Poll interval in ms. Defaults to 10 000. */
  pollMs?: number
  /** Mark data as 'stale' once updatedAt is older than this. Defaults to 30 000. */
  staleAfterMs?: number
}

export interface UseDeparturesResult {
  status: DeparturesStatus
  data: DeparturesSnapshot | null
  /** Last error message when status === 'error'. */
  error: string | null
  /** ms since data.updatedAt (computed only when data exists). */
  ageMs: number | null
  /** Force an immediate refetch (e.g. on user action). */
  refetch: () => void
}

const DEFAULT_POLL_MS  = 10_000
const DEFAULT_STALE_MS = 30_000

function userMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Access to live data is currently restricted. Please try again shortly.'
  if (status === 404) return 'Station not found.'
  if (status >= 500) return 'Live departures are temporarily unavailable. Please try again in a minute.'
  return `Request failed (${status}).`
}

export function useDepartures(opts: UseDeparturesOptions): UseDeparturesResult {
  const { code, hours, pollMs = DEFAULT_POLL_MS, staleAfterMs = DEFAULT_STALE_MS } = opts

  const [data, setData]     = useState<DeparturesSnapshot | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [status, setStatus] = useState<DeparturesStatus>('idle')
  const [ageMs, setAgeMs]   = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const pollRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ageTickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const buildUrl = useCallback(() => {
    const sp = new URLSearchParams()
    if (hours != null) sp.set('hours', String(hours))
    const qs = sp.toString()
    return `/api/darwin/departures/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`
  }, [code, hours])

  const fetchOnce = useCallback(async () => {
    if (!code) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch(buildUrl(), { signal: ac.signal })
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}))
        setData(null)
        setError(body?.error || userMessageForStatus(404))
        setStatus('not-found')
        return
      }
      if (!res.ok) throw new Error(userMessageForStatus(res.status))
      const snap: DeparturesSnapshot = await res.json()
      setData(snap)
      setError(null)
      const age = Date.now() - Date.parse(snap.updatedAt)
      setAgeMs(age)
      setStatus(age > staleAfterMs ? 'stale' : 'ok')
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setError((e as Error)?.message || 'Could not load live departures.')
      setStatus(prev => (prev === 'idle' || prev === 'loading' ? 'error' : prev))
      // Keep stale data visible if we had it; just flag the error.
    }
  }, [buildUrl, code, staleAfterMs])

  // Schedule the next poll. Pauses while tab hidden.
  const schedulePoll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current)
    if (!code) return
    pollRef.current = setTimeout(async () => {
      if (document.visibilityState === 'visible') {
        await fetchOnce()
      }
      schedulePoll()
    }, pollMs)
  }, [code, fetchOnce, pollMs])

  useEffect(() => {
    if (!code) {
      setStatus('idle')
      setData(null)
      setError(null)
      return
    }
    setStatus(prev => (data ? prev : 'loading'))
    fetchOnce()
    schedulePoll()
    return () => {
      pollRef.current && clearTimeout(pollRef.current)
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, hours, pollMs])

  // Re-fetch immediately when tab becomes visible after being hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && code) fetchOnce()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [code, fetchOnce])

  // Tick the age counter once a second so the UI's "X s ago" can update.
  useEffect(() => {
    if (!data) { setAgeMs(null); return }
    if (ageTickRef.current) clearInterval(ageTickRef.current)
    ageTickRef.current = setInterval(() => {
      const age = Date.now() - Date.parse(data.updatedAt)
      setAgeMs(age)
      setStatus(prev => {
        if (prev === 'error' || prev === 'not-found') return prev
        return age > staleAfterMs ? 'stale' : 'ok'
      })
    }, 1000)
    return () => { ageTickRef.current && clearInterval(ageTickRef.current) }
  }, [data, staleAfterMs])

  return { status, data, error, ageMs, refetch: fetchOnce }
}
