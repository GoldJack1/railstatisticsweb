import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import Button from './Button'
import './Header.css'

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  /** Don’t stack “log-in → migration” in history, or browser Back from migration returns to login. */
  const logoNavReplace = pathname === '/log-in'

  return (
    <header className="universal-header">
      <div className="header-container">
        <div className="header-left">
          <Link to="/" replace={logoNavReplace} className="logo-link">
            <div className="logo">
              <img
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                alt=""
                className="logo-mark"
                width={24}
                height={24}
                decoding="async"
                aria-hidden
              />
              <span className="logo-text">Rail Statistics</span>
            </div>
          </Link>
        </div>

        <div className="header-right">
          <Button
            variant="circle"
            onClick={toggleTheme}
            ariaLabel="Toggle theme"
            icon={
              theme === 'light' ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )
            }
          />
        </div>
      </div>
    </header>
  )
}

export default Header
