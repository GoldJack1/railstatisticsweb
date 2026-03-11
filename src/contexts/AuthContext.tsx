import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  initializeFirebase,
  getFirebaseAuth,
  onAuthStateChanged,
  handleRedirectResult,
  loginWithEmail,
  signUpWithEmail,
  loginWithGoogle as firebaseLoginWithGoogle,
  loginWithApple as firebaseLoginWithApple,
  logout as firebaseLogout,
  type User
} from '../services/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithApple: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    const init = async () => {
      await initializeFirebase()
      const auth = getFirebaseAuth()
      if (auth) {
        // Consume redirect result first (must run on page load after returning from Google/Apple)
        try {
          const result = await handleRedirectResult()
          if (result?.user) {
            setUser(result.user)
            setLoading(false)
          }
        } catch (err) {
          console.warn('Redirect result error:', err)
        }
        // Listen for auth changes (covers redirect sign-in and normal login/logout)
        unsubscribe = onAuthStateChanged(auth, (u) => {
          setUser(u)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }
    init()
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await loginWithEmail(email, password)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    await signUpWithEmail(email, password)
  }, [])

  const loginWithGoogle = useCallback(async () => {
    await firebaseLoginWithGoogle()
  }, [])

  const loginWithApple = useCallback(async () => {
    await firebaseLoginWithApple()
  }, [])

  const logout = useCallback(async () => {
    await firebaseLogout()
  }, [])

  const value: AuthContextValue = { user, loading, login, signUp, loginWithGoogle, loginWithApple, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
