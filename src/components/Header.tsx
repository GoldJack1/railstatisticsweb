import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Header.css'

const Header: React.FC = () => {
  const { pathname } = useLocation()
  /** Don’t stack “log-in → migration” in history, or browser Back from migration returns to login. */
  const logoNavReplace = pathname === '/log-in'

  return (
    <header className="universal-header">
      {/*
        iOS Safari (esp. 26+ “Liquid Glass”): in-tab chrome tint is derived from fixed
        elements with a solid background-color near the top — not theme-color. A plain strip
        under the real header avoids backdrop-filter sampling a black/wrong tone.
        https://github.com/andesco/safari-color-tinting
      */}
      <div className="safari-toolbar-tint" aria-hidden="true" />
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
      </div>
    </header>
  )
}

export default Header
