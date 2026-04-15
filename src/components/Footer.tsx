import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'
import './Footer.css'

const Footer: React.FC = () => {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <footer className="site-footer app-footer">
      <div className="site-footer-inner">
        <p>&copy; {new Date().getFullYear()} Rail Statistics</p>
        <div className="site-footer-links">
          <Link to="/home" className="site-footer-link">
            Home
          </Link>
          <Link to="/migration" className="site-footer-link">
            Migration
          </Link>
          {user && (
            <>
              <Link to="/stations" className="site-footer-link">
                Stations
              </Link>
            </>
          )}
          <Link to="/privacy" className="site-footer-link">
            Privacy Policy
          </Link>
          <Link to="/eula" className="site-footer-link">
            EULA
          </Link>
          {user ? (
            <button type="button" className="site-footer-link site-footer-logout" onClick={() => logout()}>
              Log out
            </button>
          ) : (
            <Link to="/log-in" className="site-footer-link">
              Log in
            </Link>
          )}
          <button type="button" className="site-footer-link site-footer-theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg className="site-footer-theme-toggle__icon site-footer-theme-toggle__icon--sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg className="site-footer-theme-toggle__icon site-footer-theme-toggle__icon--moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </footer>
  )
}

export default Footer
