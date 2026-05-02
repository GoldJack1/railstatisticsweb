/**
 * Darwin daemon may return 503 { error: 'starting' } while caches restore after restart.
 * This wrapper waits with backoff instead of hammering the VM or surfacing a hard error.
 */

const MAX_STARTUP_WAIT_MS = Math.max(
  60_000,
  Number(import.meta.env.VITE_DARWIN_STARTUP_MAX_WAIT_MS || 600_000),
)

function abortError(): Error {
  const e = new Error('Aborted')
  e.name = 'AbortError'
  return e
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const t = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * GET helper for `/api/darwin/*`. Retries on 503 starting until deadline or signal abort.
 */
export async function fetchDarwin(input: string, init?: RequestInit): Promise<Response> {
  const deadline = Date.now() + MAX_STARTUP_WAIT_MS
  let lastRes: Response | null = null

  while (Date.now() < deadline) {
    if (init?.signal?.aborted) throw abortError()

    const res = await fetch(input, init)
    lastRes = res

    if (res.status !== 503) return res

    let retryMs = 3000
    try {
      const body = await res.clone().json() as { error?: string; retryAfterSec?: number }
      if (body?.error !== 'starting') return res
      if (typeof body.retryAfterSec === 'number' && Number.isFinite(body.retryAfterSec)) {
        retryMs = Math.min(15_000, Math.max(800, body.retryAfterSec * 1000))
      }
    } catch {
      return res
    }

    await sleep(retryMs, init?.signal ?? undefined)
  }

  return lastRes ?? fetch(input, init)
}
