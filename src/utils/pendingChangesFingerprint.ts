import type { SandboxStationDoc, Station } from '../types'

/** One pending row as stored in context (minimal shape for fingerprinting). */
export type PendingFingerprintEntry = {
  original: Station
  updated: Partial<Station>
  sandboxUpdated?: Partial<SandboxStationDoc> | null
  isNew?: boolean
}

/**
 * Stable fingerprint of the pending publish queue. Used to ensure a server scheduled job
 * only stays active while it matches the current pending edits (until the user saves schedule again).
 */
export function computePendingChangesFingerprint(
  pending: Record<string, PendingFingerprintEntry>
): string {
  const ids = Object.keys(pending).sort()
  return JSON.stringify(
    ids.map((id) => {
      const e = pending[id]
      return {
        id,
        isNew: Boolean(e.isNew),
        updated: e.updated,
        sandboxUpdated: e.sandboxUpdated ?? null
      }
    })
  )
}
