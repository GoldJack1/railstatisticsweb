/**
 * WHATWG-style autocomplete tokens for TOTP / authenticator steps.
 * Section prefixes help password managers (Safari, Chrome, Edge, etc.) pair the
 * hidden username/email field with the one-time code field in the same form.
 */
export const MFA_AUTOFILL = {
  signInUsername: 'section-rs-mfa-signin username',
  signInOtp: 'section-rs-mfa-signin one-time-code',
  enrollUsername: 'section-rs-mfa-enroll username',
  enrollOtp: 'section-rs-mfa-enroll one-time-code',
  reauthUsername: 'section-rs-mfa-reauth username',
  reauthOtp: 'section-rs-mfa-reauth one-time-code'
} as const

/** Common `name` heuristic for Chromium-oriented password managers; keep `autoComplete` as one-time-code. */
export const MFA_OTP_INPUT_NAME = 'totp'
