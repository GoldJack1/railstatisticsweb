import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServiceDetail } from '../types/darwin'

export type ServiceDetailStatus =
  | 'idle'
  | 'loading'
  | 'ok'
  | 'stale'
  | 'error'
  | 'not-found'

export interface UseServiceDetailOptions {
  rid: string
  pollMs?: number
  staleAfterMs?: number
  date?: string
  at?: string
}

export interface UseServiceDetailResult {
  status: ServiceDetailStatus
  data: ServiceDetail | null
  error: string | null
  ageMs: number | null
  refetch: () => void
}

const DEFAULT_POLL_MS  = 15_000
const DEFAULT_STALE_MS = 60_000
const REQUEST_TIMEOUT_MS = 8_000
const MAX_NETWORK_RETRIES = 2
const RETRY_BASE_DELAY_MS = 500

function userMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Access to live service detail is currently restricted.'
  if (status === 404) return 'Service not found.'
  if (status >= 500) return 'Service detail is temporarily unavailable. Please try again shortly.'
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

/**
 * Polls /api/darwin/service/:rid every `pollMs` ms while the tab is visible.
 * Mirrors the shape and behaviour of `useDepartures`.
 */
export function useServiceDetail({
  rid,
  pollMs = DEFAULT_POLL_MS,
  staleAfterMs = DEFAULT_STALE_MS,
  date,
  at,
}: UseServiceDetailOptions): UseServiceDetailResult {
  const [data, setData]     = useState<ServiceDetail | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [status, setStatus] = useState<ServiceDetailStatus>('idle')
  const [ageMs, setAgeMs]   = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const pollRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ageTickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchOnce = useCallback(async () => {
    if (!rid) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const qs = new URLSearchParams()
      if (date) qs.set('date', date)
      if (at) qs.set('at', at)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      const url = `/api/darwin/service/${encodeURIComponent(rid)}${suffix}`
      let res: Response | null = null
      for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt += 1) {
        if (ac.signal.aborted) throw createAbortError()
        const attemptAc = new AbortController()
        let timedOut = false
        const onParentAbort = () => attemptAc.abort()
        ac.signal.addEventListener('abort', onParentAbort, { once: true })
        const timeoutId = setTimeout(() => {
          timedOut = true
          attemptAc.abort()
        }, REQUEST_TIMEOUT_MS)
        try {
          res = await fetch(url, { signal: attemptAc.signal })
          clearTimeout(timeoutId)
          ac.signal.removeEventListener('abort', onParentAbort)
          break
        } catch (rawErr) {
          clearTimeout(timeoutId)
          ac.signal.removeEventListener('abort', onParentAbort)
          const err = rawErr as Error
          if (ac.signal.aborted) throw createAbortError()
          if (attempt === MAX_NETWORK_RETRIES) {
            throw new Error(timedOut ? userMessageForNetworkFailure() : (err.message || userMessageForNetworkFailure()))
          }
          if (!timedOut && !isTransientNetworkError(err)) throw err
          await delay(RETRY_BASE_DELAY_MS * (attempt + 1), ac.signal)
        }
      }
      if (!res) throw new Error(userMessageForNetworkFailure())
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}))
        setData(null)
        setError(body?.error || userMessageForStatus(404))
        setStatus('not-found')
        return
      }
      if (!res.ok) throw new Error(userMessageForStatus(res.status))
      const detail: ServiceDetail = await res.json()
      setData(detail)
      setError(null)
      const age = Date.now() - Date.parse(detail.updatedAt)
      setAgeMs(age)
      setStatus(age > staleAfterMs ? 'stale' : 'ok')
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setError((e as Error)?.message || 'Could not load service detail.')
      setStatus(prev => (prev === 'idle' || prev === 'loading' ? 'error' : prev))
    }
  }, [rid, staleAfterMs, date, at])

  const schedulePoll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current)
    if (!rid) return
    pollRef.current = setTimeout(async () => {
      if (document.visibilityState === 'visible') await fetchOnce()
      schedulePoll()
    }, pollMs)
  }, [rid, fetchOnce, pollMs])

  useEffect(() => {
    if (!rid) { setStatus('idle'); setData(null); setError(null); return }
    setStatus(prev => (data ? prev : 'loading'))
    fetchOnce()
    schedulePoll()
    return () => {
      pollRef.current && clearTimeout(pollRef.current)
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, pollMs, date, at])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && rid) fetchOnce()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [rid, fetchOnce])

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
