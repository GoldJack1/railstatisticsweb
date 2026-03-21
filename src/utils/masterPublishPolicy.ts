import type { User } from 'firebase/auth'

/**
 * Default owner email for publish/schedule UI gating. Override with `VITE_MASTER_PUBLISH_EMAIL`.
 *
 * **Firestore:** writes are enforced in `firestore.rules` via the same default email OR custom claim
 * `rs_station_editor` (see `docs/SECURITY_FIRESTORE.md`). Changing only this env var does not update rules.
 */
const DEFAULT_MASTER_PUBLISH_EMAIL = 'wingatejack2021@gmail.com'

export function getMasterPublishEmail(): string {
  const raw = import.meta.env.VITE_MASTER_PUBLISH_EMAIL ?? DEFAULT_MASTER_PUBLISH_EMAIL
  return String(raw).trim().toLowerCase()
}

/** True if this signed-in user may publish pending changes or create/cancel server schedules. */
export function isMasterPublishUser(user: User | null): boolean {
  const expected = getMasterPublishEmail()
  if (!expected) return false
  const email = user?.email?.trim().toLowerCase() ?? ''
  return email.length > 0 && email === expected
}

export const MASTER_PUBLISH_DENIED_MESSAGE =
  'Only the site owner can publish or schedule changes to the database. Sign in with the owner account.'
