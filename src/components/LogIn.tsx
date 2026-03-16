import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './LogIn.css'

const LogIn: React.FC = () => {
  const { user, login, signUp } = useAuth()
  const navigate = useNavigate()

  // After returning from Google/Apple redirect, or if already logged in, go to stations
  useEffect(() => {
    if (user) {
      navigate('/stations', { replace: true })
    }
  }, [user, navigate])
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">{isSignUp ? 'Create account' : 'Log in'}</h1>
        <p className="login-subtitle">
          {isSignUp
            ? 'Sign up to access the stations page.'
            : 'Log in to view the stations page.'}
        </p>

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
