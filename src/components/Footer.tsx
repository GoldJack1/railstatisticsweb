import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Footer.css'

const Footer: React.FC = () => {
  const { user, logout } = useAuth()

  return (
    <footer className="site-footer app-footer">
      <div className="site-footer-inner">
        <p>&copy; {new Date().getFullYear()} Rail Statistics</p>
        <div className="site-footer-links">
          {user && (
            <>
              <Link to="/migration" className="site-footer-link">
                Migration
              </Link>
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
        </div>
      </div>
    </footer>
  )
}

export default Footer
