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

function userMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Access to live service detail is currently restricted.'
  if (status === 404) return 'Service not found.'
  if (status >= 500) return 'Service detail is temporarily unavailable. Please try again shortly.'
  return `Request failed (${status}).`
}

/**
 * Polls /api/darwin/service/:rid every `pollMs` ms while the tab is visible.
 * Mirrors the shape and behaviour of `useDepartures`.
 */
export function useServiceDetail({
  rid,
  pollMs = DEFAULT_POLL_MS,
  staleAfterMs = DEFAULT_STALE_MS,
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
      const res = await fetch(`/api/darwin/service/${encodeURIComponent(rid)}`, { signal: ac.signal })
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
  }, [rid, staleAfterMs])

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
  }, [rid, pollMs])

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
