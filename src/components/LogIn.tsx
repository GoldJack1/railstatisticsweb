import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './LogIn.css'

const LogIn: React.FC = () => {
  const { login, signUp, loginWithGoogle, loginWithApple } = useAuth()
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
      } else {
        await login(email, password)
      }
      navigate('/stations', { replace: true })
    } catch (err: unknown) {
      let message = 'Something went wrong'
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          message = 'Invalid email or password.'
        } else if (code === 'auth/email-already-in-use') {
          message = 'This email is already in use. Try logging in.'
        } else if (code === 'auth/weak-password') {
          message = 'Password should be at least 6 characters.'
        } else if (code === 'auth/invalid-email') {
          message = 'Please enter a valid email address.'
        } else {
          message = err instanceof Error ? err.message : String(code)
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSocialError = (err: unknown): string => {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return '' // User closed popup, don't show error
      }
      if (code === 'auth/account-exists-with-different-credential') {
        return 'This email is already linked to another sign-in method. Try logging in with email or that method.'
      }
      if (code === 'auth/popup-blocked') {
        return 'Sign-in popup was blocked. Allow popups for this site and try again.'
      }
      return err instanceof Error ? err.message : String(code)
    }
    return err instanceof Error ? err.message : 'Something went wrong'
  }

  const handleGoogle = async () => {
    setError(null)
    setSocialLoading('google')
    try {
      await loginWithGoogle()
      navigate('/stations', { replace: true })
    } catch (err) {
      const message = handleSocialError(err)
      if (message) setError(message)
    } finally {
      setSocialLoading(null)
    }
  }

  const handleApple = async () => {
    setError(null)
    setSocialLoading('apple')
    try {
      await loginWithApple()
      navigate('/stations', { replace: true })
    } catch (err) {
      const message = handleSocialError(err)
      if (message) setError(message)
    } finally {
      setSocialLoading(null)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">{isSignUp ? 'Create account' : 'Log in'}</h1>
        <p className="login-subtitle">
          {isSignUp
            ? 'Sign up to access the stations page.'
            : 'Log in to view the stations page.'}
        </p>

        <div className="login-social">
          <button
            type="button"
            className="login-social-btn login-google"
            onClick={handleGoogle}
            disabled={!!socialLoading}
          >
            {socialLoading === 'google' ? (
              <span className="login-social-loading">Signing in…</span>
            ) : (
              <>
                <svg className="login-social-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>
          <button
            type="button"
            className="login-social-btn login-apple"
            onClick={handleApple}
            disabled={!!socialLoading}
          >
            {socialLoading === 'apple' ? (
              <span className="login-social-loading">Signing in…</span>
            ) : (
              <>
                <svg className="login-social-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Continue with Apple
              </>
            )}
          </button>
        </div>

        <p className="login-divider">or</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="login-email" className="login-label">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <label htmlFor="login-password" className="login-label">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            placeholder="••••••••"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={6}
          />
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Log in'}
          </button>
        </form>
        <p className="login-toggle">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="login-toggle-btn"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
          >
            {isSignUp ? 'Log in' : 'Create account'}
          </button>
        </p>
      </div>
    </div>
  )
}

export default LogIn
