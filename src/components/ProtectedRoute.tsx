import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          fontSize: '18px',
          color: 'var(--text-secondary)'
        }}
      >
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/log-in" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
