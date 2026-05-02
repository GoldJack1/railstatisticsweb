import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeparturesSnapshot } from '../types/darwin'
import { fetchDarwin } from '../utils/darwinReadyFetch'

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
  date?: string
  at?: string
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
const MAX_NETWORK_RETRIES = 2
const RETRY_BASE_DELAY_MS = 500
const LIVE_CACHE_MAX_AGE_MS = 15_000
const HIST_CACHE_MAX_AGE_MS = 5 * 60_000
const CACHE_MAX_ENTRIES = 200

interface DeparturesCacheEntry {
  key: string
  data: DeparturesSnapshot
  cachedAtMs: number
}

const departuresSWRCache = new Map<string, DeparturesCacheEntry>()

function userMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Access to live data is currently restricted. Please try again shortly.'
  if (status === 404) return 'Station not found.'
  if (status >= 500) return 'Live departures are temporarily unavailable. Please try again in a minute.'
  return `Request failed (${status}).`
}

function userMessageForNetworkFailure(): string {
  return 'Darwin API did not respond in time. Retrying failed — please try again shortly.'
}

function isTransientNetworkError(err: Error): boolean {
  if (err.name === 'AbortError') return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('eai_again') ||
    msg.includes('failed to fetch')
  )
}

function createAbortError(): Error {
  const abortErr = new Error('Aborted')
  abortErr.name = 'AbortError'
  return abortErr
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw createAbortError()
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(createAbortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function useDepartures(opts: UseDeparturesOptions): UseDeparturesResult {
  const { code, hours, pollMs = DEFAULT_POLL_MS, staleAfterMs = DEFAULT_STALE_MS, date, at } = opts
  const effectivePollMs = date ? 0 : pollMs
  const cacheMaxAgeMs = date ? HIST_CACHE_MAX_AGE_MS : LIVE_CACHE_MAX_AGE_MS

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
    if (date) sp.set('date', date)
    if (at) sp.set('at', at)
    const qs = sp.toString()
    return `/api/darwin/departures/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`
  }, [code, hours, date, at])

  const cacheKey = `${code}|${hours ?? ''}|${date ?? ''}|${at ?? ''}`

  const putCache = useCallback((key: string, snap: DeparturesSnapshot) => {
    const now = Date.now()
    departuresSWRCache.set(key, { key, data: snap, cachedAtMs: now })
    if (departuresSWRCache.size <= CACHE_MAX_ENTRIES) return
    // Evict oldest entries first.
    const oldest = [...departuresSWRCache.entries()]
      .sort((a, b) => a[1].cachedAtMs - b[1].cachedAtMs)
      .slice(0, departuresSWRCache.size - CACHE_MAX_ENTRIES)
    for (const [k] of oldest) departuresSWRCache.delete(k)
  }, [])

  const getFreshCache = useCallback((key: string): DeparturesSnapshot | null => {
    const hit = departuresSWRCache.get(key)
    if (!hit) return null
    if (Date.now() - hit.cachedAtMs > cacheMaxAgeMs) {
      departuresSWRCache.delete(key)
      return null
    }
    return hit.data
  }, [cacheMaxAgeMs])

  const fetchOnce = useCallback(async () => {
    if (!code) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const url = buildUrl()
      let res: Response | null = null
      for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt += 1) {
        if (ac.signal.aborted) throw createAbortError()
        try {
          res = await fetchDarwin(url, { signal: ac.signal })
          break
        } catch (rawErr) {
          const err = rawErr as Error
          if (ac.signal.aborted) throw createAbortError()
          if (attempt === MAX_NETWORK_RETRIES) {
            throw new Error(err.message || userMessageForNetworkFailure())
          }
          if (!isTransientNetworkError(err)) throw err
          await delay(RETRY_BASE_DELAY_MS * (attempt + 1), ac.signal)
        }
      }
      if (!res) throw new Error(userMessageForNetworkFailure())
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}))
        departuresSWRCache.delete(cacheKey)
        setData(null)
        setError(body?.error || userMessageForStatus(404))
        setStatus('not-found')
        return
      }
      if (!res.ok) throw new Error(userMessageForStatus(res.status))
      const snap: DeparturesSnapshot = await res.json()
      putCache(cacheKey, snap)
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
  }, [buildUrl, cacheKey, code, putCache, staleAfterMs])

  // Schedule the next poll. Pauses while tab hidden.
  const schedulePoll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current)
    if (!code) return
    if (effectivePollMs <= 0) return
    pollRef.current = setTimeout(async () => {
      if (document.visibilityState === 'visible') {
        await fetchOnce()
      }
      schedulePoll()
    }, effectivePollMs)
  }, [code, fetchOnce, effectivePollMs])

  useEffect(() => {
    if (!code) {
      setStatus('idle')
      setData(null)
      setError(null)
      return
    }
    // SWR behavior:
    // - if we have recent cache for this key, show it instantly
    // - always revalidate in background for fresh data
    const cached = getFreshCache(cacheKey)
    if (cached) {
      setData(cached)
      setError(null)
      const age = Date.now() - Date.parse(cached.updatedAt)
      setAgeMs(age)
      setStatus(age > staleAfterMs ? 'stale' : 'ok')
    } else {
      setData(null)
      setError(null)
      setStatus('loading')
    }
    fetchOnce()
    schedulePoll()
    return () => {
      pollRef.current && clearTimeout(pollRef.current)
      abortRef.current?.abort()
    }
  }, [cacheKey, code, date, fetchOnce, getFreshCache, hours, pollMs, schedulePoll, staleAfterMs, at])

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
