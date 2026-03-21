import React, { useEffect, useRef, useState } from 'react'
import {
  EmailAuthProvider,
  getMultiFactorResolver,
  reauthenticateWithCredential,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type User
} from 'firebase/auth'
import { initializeFirebase, getFirebaseAuth } from '../services/firebase'
import { getTotpMfaHints, isMultiFactorAuthRequiredError, mapTotpMfaError } from '../services/firebaseTotpMfa'
import Button from './Button'
import { MFA_AUTOFILL, MFA_OTP_INPUT_NAME } from '../constants/mfaAutofill'
import './PasswordReauthModal.css'

export interface PasswordReauthModalProps {
  open: boolean
  user: User | null
  onClose: () => void
  /** Called after successful reauthentication. */
  onVerified: () => void
  title?: string
}

type Phase = 'password' | 'totp'

/**
 * Step-up before sensitive actions: password, then authenticator (TOTP) if enrolled.
 */
const PasswordReauthModal: React.FC<PasswordReauthModalProps> = ({
  open,
  user,
  onClose,
  onVerified,
  title = 'Confirm it’s you'
}) => {
  const [phase, setPhase] = useState<Phase>('password')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resolverRef = useRef<MultiFactorResolver | null>(null)

  useEffect(() => {
    if (!open) {
      setPhase('password')
      setPassword('')
      setTotpCode('')
      setError(null)
      setBusy(false)
      resolverRef.current = null
    }
  }, [open])

  if (!open || !user) return null

  const email = user.email?.trim() ?? ''

  const handlePasswordContinue = async () => {
    setError(null)
    if (!email) {
      setError('Your account has no email on file; contact support.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setBusy(true)
    try {
      await initializeFirebase()
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Auth not available')
      const cred = EmailAuthProvider.credential(email, password)
      await reauthenticateWithCredential(user, cred)
      setPassword('')
      resolverRef.current = null
      onVerified()
      onClose()
    } catch (e) {
      if (isMultiFactorAuthRequiredError(e)) {
        const authInstance = getFirebaseAuth()
        if (!authInstance) {
          setError('Auth not available.')
          return
        }
        try {
          const resolver = getMultiFactorResolver(authInstance, e as MultiFactorError)
          const hints = getTotpMfaHints(resolver)
          if (hints.length === 0) {
            setError(
              'This account uses a second factor this app does not support. Use Firebase Console to use TOTP (authenticator) or remove SMS-only MFA.'
            )
            return
          }
          resolverRef.current = resolver
          setPhase('totp')
          setError(null)
          return
        } catch {
          setError('Could not start authenticator step. Try again.')
          return
        }
      }
      if (e && typeof e === 'object' && 'code' in e) {
        const code = String((e as { code: string }).code)
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setError('Incorrect password.')
          return
        }
      }
      setError(e instanceof Error ? e.message : 'Could not verify password.')
    } finally {
      setBusy(false)
    }
  }

  const handleTotpContinue = async () => {
    setError(null)
    const resolver = resolverRef.current
    const auth = getFirebaseAuth()
    if (!resolver || !auth) {
      setError('Session expired. Close and try again.')
      return
    }
    const hints = getTotpMfaHints(resolver)
    const hint = hints[0]
    if (!hint) {
      setError('No authenticator factor found.')
      return
    }
    const code = totpCode.replace(/\s/g, '')
    if (!/^\d{6,8}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setBusy(true)
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)
      await resolver.resolveSignIn(assertion)
      setTotpCode('')
      setPassword('')
      resolverRef.current = null
      setPhase('password')
      onVerified()
      onClose()
    } catch (e) {
      setError(mapTotpMfaError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="password-reauth-overlay" role="presentation" onClick={onClose}>
      <div
        className="password-reauth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-reauth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="password-reauth-title" className="password-reauth-title">
          {title}
        </h2>
        {phase === 'password' && (
          <>
            <p className="password-reauth-intro">
              Enter your password to continue. If you use an authenticator for this account, you’ll be asked for a
              code next.
            </p>
            <label className="password-reauth-label" htmlFor="password-reauth-field">
              Password
            </label>
            <input
              id="password-reauth-field"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="password-reauth-input"
              autoComplete="current-password"
              disabled={busy}
            />
            {error && (
              <p className="password-reauth-error" role="alert">
                {error}
              </p>
            )}
            <div className="password-reauth-actions">
              <Button type="button" variant="wide" width="hug" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="wide" width="hug" onClick={() => void handlePasswordContinue()} disabled={busy}>
                {busy ? 'Checking…' : 'Continue'}
              </Button>
            </div>
          </>
        )}
        {phase === 'totp' && (
          <form
            id="password-reauth-totp-form"
            className="password-reauth-mfa-form"
            method="post"
            action="#"
            onSubmit={(e) => {
              e.preventDefault()
              void handleTotpContinue()
            }}
            autoComplete="on"
          >
            <p className="password-reauth-intro">Enter the code from your authenticator app.</p>
            <input
              className="autofill-bridge-input"
              type="email"
              name="username"
              autoComplete={MFA_AUTOFILL.reauthUsername}
              value={email}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
            />
            <label className="password-reauth-label" htmlFor="password-reauth-totp">
              6-digit code
            </label>
            <input
              id="password-reauth-totp"
              name={MFA_OTP_INPUT_NAME}
              type="text"
              inputMode="numeric"
              autoComplete={MFA_AUTOFILL.reauthOtp}
              pattern="[0-9]*"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={8}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="password-reauth-input"
              placeholder="123456"
              disabled={busy}
            />
            {error && (
              <p className="password-reauth-error" role="alert">
                {error}
              </p>
            )}
            <div className="password-reauth-actions">
              <Button type="button" variant="wide" width="hug" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="wide"
                width="hug"
                onClick={() => {
                  setPhase('password')
                  setTotpCode('')
                  setError(null)
                  resolverRef.current = null
                }}
                disabled={busy}
              >
                Back
              </Button>
              <Button type="submit" variant="wide" width="hug" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default PasswordReauthModal
