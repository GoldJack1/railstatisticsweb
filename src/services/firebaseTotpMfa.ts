import {
  type User,
  type MultiFactorResolver,
  type MultiFactorInfo,
  multiFactor,
  TotpMultiFactorGenerator
} from 'firebase/auth'

/** Issuer name embedded in authenticator QR / otpauth URI. */
export const TOTP_ISSUER_NAME = 'Rail Statistics'

export function isMultiFactorAuthRequiredError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'auth/multi-factor-auth-required'
  )
}

export function getTotpMfaHints(resolver: MultiFactorResolver): MultiFactorInfo[] {
  return resolver.hints.filter((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)
}

/** User has completed TOTP MFA enrollment on Firebase (Identity Platform). */
export function userHasEnrolledTotpMfa(user: User): boolean {
  return multiFactor(user).enrolledFactors.some((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)
}

/**
 * Logged-in user must add an authenticator (TOTP) before using the app.
 * Email must be verified first (Firebase requirement for MFA enrollment).
 */
export function userMustEnrollTotpMfaOnFirebase(user: User): boolean {
  return user.emailVerified && !userHasEnrolledTotpMfa(user)
}

export function mapTotpMfaError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code)
    if (code === 'auth/invalid-verification-code') {
      return 'That code isn’t valid. Check your authenticator app and try again.'
    }
    if (code === 'auth/code-expired') {
      return 'That code has expired. Wait for a new one from your authenticator app.'
    }
    if (code === 'auth/unverified-email') {
      return 'Verify your email before you can set up an authenticator.'
    }
    if (code === 'auth/operation-not-allowed' || code === 'auth/unauthorized-domain') {
      return 'TOTP (authenticator) is not enabled for this Firebase project. Enable it in Google Cloud / Identity Platform (TOTP MFA provider).'
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong with authenticator setup.'
}
