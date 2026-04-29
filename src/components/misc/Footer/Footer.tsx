import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { useTheme } from '../../../hooks/useTheme'
import { BUTFooterLink } from '../../buttons'
import './Footer.css'

const Footer: React.FC = () => {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const isStationsPage = location.pathname.startsWith('/stations')

  const handleAdminToggle = () => {
    if (isStationsPage) {
      const params = new URLSearchParams(location.search)
      if (params.get('admin') === '1') {
        params.delete('admin')
      } else {
        params.set('admin', '1')
      }
      const query = params.toString()
      navigate(query.length > 0 ? `/stations?${query}` : '/stations')
      return
    }

    navigate('/stations?admin=1')
  }

  return (
    <footer className="site-footer app-footer">
      <div className="site-footer-inner">
        <div className="site-footer-primary-row">
          <p>&copy; {new Date().getFullYear()} Rail Statistics</p>
          <div className="site-footer-links site-footer-links--base-row">
            <BUTFooterLink to="/home">
              Home
            </BUTFooterLink>
            <BUTFooterLink to="/departures/LDS">
              Departures
            </BUTFooterLink>
            <BUTFooterLink to="/migration">
              Migration
            </BUTFooterLink>
            <BUTFooterLink to="/privacy">
              Privacy Policy
            </BUTFooterLink>
            <BUTFooterLink to="/eula">
              EULA
            </BUTFooterLink>
            {user ? (
              <BUTFooterLink onActivate={logout} className="site-footer-logout">
                Log out
              </BUTFooterLink>
            ) : (
              <BUTFooterLink to="/log-in">
                Log in
              </BUTFooterLink>
            )}
            <BUTFooterLink onActivate={toggleTheme} className="site-footer-theme-toggle" ariaLabel="Toggle theme">
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
            </BUTFooterLink>
          </div>
        </div>
        {user ? (
          <div className="site-footer-secondary-row">
            <div className="site-footer-links site-footer-links--logged-in-row">
              <BUTFooterLink to="/stations">
                Stations
              </BUTFooterLink>
              <BUTFooterLink to="/design-system">
                Design System
              </BUTFooterLink>
              <BUTFooterLink onActivate={handleAdminToggle}>
                Admin
              </BUTFooterLink>
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  )
}

export default Footer
