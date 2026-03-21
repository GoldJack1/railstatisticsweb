/**
 * Legacy env gate for “sensitive reauthentication”. **Stations → Publish now / Save schedule** always use
 * password + TOTP in the modal (not controlled by this). Kept for any future callers.
 *
 * Env (first match wins):
 * - `VITE_REQUIRE_REAUTH_FOR_SENSITIVE_ACTIONS`
 * - `VITE_REQUIRE_SMS_FOR_SENSITIVE_ACTIONS` — legacy alias
 *
 * Default: required in production; in dev, disabled unless explicitly `true`.
 */
export function shouldRequireReauthForSensitiveActions(): boolean {
  if (typeof window === 'undefined') return false
  const v =
    import.meta.env.VITE_REQUIRE_REAUTH_FOR_SENSITIVE_ACTIONS ?? import.meta.env.VITE_REQUIRE_SMS_FOR_SENSITIVE_ACTIONS
  if (v === 'false' || v === '0') return false
  if (v === 'true' || v === '1') return true
  return import.meta.env.PROD
}

/** @deprecated Use shouldRequireReauthForSensitiveActions — SMS verification was removed. */
export const shouldRequireSmsForSensitiveActions = shouldRequireReauthForSensitiveActions
