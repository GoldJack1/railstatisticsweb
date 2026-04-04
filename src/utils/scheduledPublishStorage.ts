/** localStorage key for “publish all pending changes” at a given time (ms since epoch). */
export const SCHEDULED_PUBLISH_AT_MS_KEY = 'railstatistics-scheduled-publish-at-ms'

export function readScheduledPublishAtMs(): number | null {
  try {
    const v = localStorage.getItem(SCHEDULED_PUBLISH_AT_MS_KEY)
    if (v == null) return null
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function writeScheduledPublishAtMs(ms: number | null): void {
  try {
    if (ms == null) {
      localStorage.removeItem(SCHEDULED_PUBLISH_AT_MS_KEY)
    } else {
      localStorage.setItem(SCHEDULED_PUBLISH_AT_MS_KEY, String(ms))
    }
  } catch {
    /* quota / private mode */
  }
}

/** Active server-side scheduled publish job (Firestore doc id). */
export const SERVER_SCHEDULED_JOB_ID_KEY = 'railstatistics-server-scheduled-job-id'

export function readServerScheduledJobId(): string | null {
  try {
    const v = localStorage.getItem(SERVER_SCHEDULED_JOB_ID_KEY)
    if (v == null || v.trim() === '') return null
    return v
  } catch {
    return null
  }
}

export function writeServerScheduledJobId(id: string | null): void {
  try {
    if (id == null || id.trim() === '') {
      localStorage.removeItem(SERVER_SCHEDULED_JOB_ID_KEY)
    } else {
      localStorage.setItem(SERVER_SCHEDULED_JOB_ID_KEY, id)
    }
  } catch {
    /* quota / private mode */
  }
}

/**
 * Fingerprint of pending changes when the user last saved a server schedule.
 * Used to show when the local queue has drifted from that snapshot (the job is not auto-cancelled).
 */
export const SCHEDULE_SAVED_PENDING_FINGERPRINT_KEY = 'railstatistics-schedule-saved-pending-fingerprint'

export function readScheduleSavedFingerprint(): string | null {
  try {
    const v = localStorage.getItem(SCHEDULE_SAVED_PENDING_FINGERPRINT_KEY)
    if (v == null || v === '') return null
    return v
  } catch {
    return null
  }
}

export function writeScheduleSavedFingerprint(fp: string | null): void {
  try {
    if (fp == null || fp === '') {
      localStorage.removeItem(SCHEDULE_SAVED_PENDING_FINGERPRINT_KEY)
    } else {
      localStorage.setItem(SCHEDULE_SAVED_PENDING_FINGERPRINT_KEY, fp)
    }
  } catch {
    /* quota / private mode */
  }
}
