import React, { useRef, useState } from 'react'
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
import Button from './BUTMappedButton'
import { MFA_AUTOFILL, MFA_OTP_INPUT_NAME } from '../constants/mfaAutofill'
import './PasswordReauthModal.css'

export type FirebaseReauthLayout = 'phased' | 'stacked'

export interface FirebaseReauthPanelProps {
  user: User
  /** Called after password (+ TOTP if required) succeeds. */
  onVerified: () => void
  onCancel: () => void
  title?: string
  /** For nested dialogs use h3. */
  titleHeading?: 'h2' | 'h3'
  /** `stacked` shows password + TOTP in one view with a single Verify action (password is checked first; TOTP runs in the same step when required). */
  layout?: FirebaseReauthLayout
}

type Phase = 'password' | 'totp'

/**
 * Password re-auth and TOTP when the account uses Firebase MFA (Identity Platform).
 */
const FirebaseReauthPanel: React.FC<FirebaseReauthPanelProps> = ({
  user,
  onVerified,
  onCancel,
  title = 'Confirm it’s you',
  titleHeading = 'h2',
  layout = 'stacked'
}) => {
  const [phase, setPhase] = useState<Phase>('password')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaPending, setMfaPending] = useState(false)
  const resolverRef = useRef<MultiFactorResolver | null>(null)

  const email = user.email?.trim() ?? ''

  const resetMfaChallenge = () => {
    resolverRef.current = null
    setMfaPending(false)
    setTotpCode('')
  }

  /** Returns true only after Firebase accepts the TOTP assertion. */
  const verifyTotpWithResolver = async (): Promise<boolean> => {
    const resolver = resolverRef.current
    const auth = getFirebaseAuth()
    if (!resolver || !auth) {
      setError('Session expired. Close and try again.')
      return false
    }
    const hints = getTotpMfaHints(resolver)
    const hint = hints[0]
    if (!hint) {
      setError('No authenticator factor found.')
      return false
    }
    const code = totpCode.replace(/\s/g, '')
    if (!/^\d{6,8}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return false
    }
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)
      await resolver.resolveSignIn(assertion)
      return true
    } catch (e) {
      setError(mapTotpMfaError(e))
      return false
    }
  }

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
      setTotpCode('')
      setPhase('password')
      onVerified()
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
    setBusy(true)
    try {
      const ok = await verifyTotpWithResolver()
      if (!ok) return
      setTotpCode('')
      setPassword('')
      resolverRef.current = null
      setMfaPending(false)
      setPhase('password')
      onVerified()
    } finally {
      setBusy(false)
    }
  }

  const handleUnifiedVerify = async () => {
    setError(null)

    if (resolverRef.current) {
      await handleTotpContinue()
      return
    }

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
      setMfaPending(false)
      setTotpCode('')
      onVerified()
    } catch (e) {
      if (isMultiFactorAuthRequiredError(e)) {
        try {
          const authInstance = getFirebaseAuth()
          if (!authInstance) {
            setError('Auth not available.')
            return
          }
          const resolver = getMultiFactorResolver(authInstance, e as MultiFactorError)
          const hints = getTotpMfaHints(resolver)
          if (hints.length === 0) {
            setError(
              'This account uses a second factor this app does not support. Use Firebase Console to use TOTP (authenticator) or remove SMS-only MFA.'
            )
            return
          }
          resolverRef.current = resolver
          setMfaPending(true)
          const code = totpCode.replace(/\s/g, '')
          if (/^\d{6,8}$/.test(code)) {
            const ok = await verifyTotpWithResolver()
            if (ok) {
              setPassword('')
              setTotpCode('')
              resolverRef.current = null
              setMfaPending(false)
              onVerified()
            }
          } else {
            setError('Enter the 6-digit authenticator code.')
          }
        } catch {
          setError('Could not start authenticator step. Try again.')
        }
        return
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

  const TitleTag = titleHeading

  if (layout === 'stacked') {
    return (
      <form
        className="firebase-reauth-panel firebase-reauth-panel--stacked"
        method="post"
        action="#"
        onSubmit={e => {
          e.preventDefault()
          void handleUnifiedVerify()
        }}
        autoComplete="on"
      >
        <TitleTag id="firebase-reauth-title" className="password-reauth-title">
          {title}
        </TitleTag>
        <p className="password-reauth-intro">
          Enter your <strong>password</strong> and <strong>authenticator code</strong>, then tap <strong>Verify</strong>.
          Password managers can fill both when your account uses 2FA; accounts without 2FA only need a password.
        </p>
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
        <label className="password-reauth-label" htmlFor="firebase-reauth-password-stacked">
          Password
        </label>
        <input
          id="firebase-reauth-password-stacked"
          type="password"
          name="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="password-reauth-input"
          autoComplete="current-password"
          disabled={busy || mfaPending}
          required
        />
        <label className="password-reauth-label" htmlFor="firebase-reauth-totp-stacked">
          Authenticator code
        </label>
        <input
          id="firebase-reauth-totp-stacked"
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
          onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className="password-reauth-input"
          placeholder="123456"
          disabled={busy}
          required={mfaPending}
          aria-required={mfaPending}
        />
        {error && (
          <p className="password-reauth-error" role="alert">
            {error}
          </p>
        )}
        <div className="password-reauth-actions">
          <Button type="button" variant="wide" width="hug" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {mfaPending && (
            <Button
              type="button"
              variant="wide"
              width="hug"
              onClick={() => {
                resetMfaChallenge()
                setError(null)
              }}
              disabled={busy}
            >
              Start over
            </Button>
          )}
          <Button type="submit" variant="wide" width="hug" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="firebase-reauth-panel">
      <TitleTag id="password-reauth-title" className="password-reauth-title">
        {title}
      </TitleTag>
      {phase === 'password' && (
        <>
          <p className="password-reauth-intro">
            Enter your password to continue. If you use an authenticator for this account, you’ll be asked for a code
            next.
          </p>
          <label className="password-reauth-label" htmlFor="password-reauth-field">
            Password
          </label>
          <input
            id="password-reauth-field"
            type="password"
            name="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
            <Button type="button" variant="wide" width="hug" onClick={onCancel} disabled={busy}>
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
          className="password-reauth-mfa-form"
          method="post"
          action="#"
          onSubmit={e => {
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
            onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
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
            <Button type="button" variant="wide" width="hug" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="wide"
              width="hug"
              onClick={() => {
                setPhase('password')
                resetMfaChallenge()
                setError(null)
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
  )
}

export default FirebaseReauthPanel
