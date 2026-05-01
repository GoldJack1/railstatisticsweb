import { useCallback, useEffect, useRef, useState } from 'react'
import type { UnitDetail } from '../types/darwin'

export type UnitDetailStatus =
  | 'idle'
  | 'loading'
  | 'ok'
  | 'error'
  | 'not-found'

export interface UseUnitDetailOptions {
  unitId: string
}

export interface UseUnitDetailResult {
  status: UnitDetailStatus
  data: UnitDetail | null
  error: string | null
  refetch: () => void
}

type UnitDetailCacheEntry = {
  detail: UnitDetail
  cachedAtMs: number
}

const unitDetailCache = new Map<string, UnitDetailCacheEntry>()
const UNIT_DETAIL_CACHE_TTL_MS = 5 * 60_000

function userMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Access to unit data is currently restricted.'
  if (status === 404) return 'Unit not found.'
  if (status >= 500) return 'Unit data is temporarily unavailable. Please try again shortly.'
  return `Request failed (${status}).`
}

export function useUnitDetail({ unitId }: UseUnitDetailOptions): UseUnitDetailResult {
  const [data, setData] = useState<UnitDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<UnitDetailStatus>('idle')
  const abortRef = useRef<AbortController | null>(null)

  const fetchOnce = useCallback(async () => {
    if (!unitId) {
      setStatus('idle')
      setData(null)
      setError(null)
      return
    }

    const cached = unitDetailCache.get(unitId)
    if (cached && Date.now() - cached.cachedAtMs <= UNIT_DETAIL_CACHE_TTL_MS) {
      setData(cached.detail)
      setError(null)
      setStatus('ok')
      return
    }

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setStatus('loading')

    try {
      const res = await fetch(`/api/darwin/unit/${encodeURIComponent(unitId)}`, { signal: ac.signal })
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}))
        setStatus('not-found')
        setData(null)
        setError(body?.error || userMessageForStatus(404))
        return
      }
      if (!res.ok) throw new Error(userMessageForStatus(res.status))
      const detail: UnitDetail = await res.json()
      unitDetailCache.set(unitId, { detail, cachedAtMs: Date.now() })
      setData(detail)
      setError(null)
      setStatus('ok')
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setError((e as Error)?.message || 'Could not load unit detail.')
      setStatus('error')
    }
  }, [unitId])

  useEffect(() => {
    fetchOnce()
    return () => abortRef.current?.abort()
  }, [fetchOnce])

  return { status, data, error, refetch: fetchOnce }
}

