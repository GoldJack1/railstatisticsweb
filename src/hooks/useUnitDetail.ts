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
        setError(body?.error || 'unit not found')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const detail: UnitDetail = await res.json()
      setData(detail)
      setError(null)
      setStatus('ok')
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      setError((e as Error)?.message || String(e))
      setStatus('error')
    }
  }, [unitId])

  useEffect(() => {
    fetchOnce()
    return () => abortRef.current?.abort()
  }, [fetchOnce])

  return { status, data, error, refetch: fetchOnce }
}

