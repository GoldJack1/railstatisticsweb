import React, { useEffect, useId } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { BUTHeaderLink } from '../../buttons'
import './Header.css'

/** Title shown next to the logo on narrow viewports (main nav items stay in the hamburger). */
function getHeaderPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/home') return 'Home'
  if (pathname === '/migration') return 'Migration'
  if (pathname === '/log-in') return 'Log in'
  if (pathname === '/privacy') return 'Privacy Policy'
  if (pathname === '/eula') return 'EULA'
  if (pathname === '/buttons') return 'Buttons'
  if (pathname.startsWith('/stations/new')) return 'New station'
  if (pathname.startsWith('/stations/pending-review')) return 'Pending review'
  if (pathname.startsWith('/stations/')) return 'Station'
  if (pathname === '/stations') return 'Stations'
  if (pathname.startsWith('/design-system/colours')) return 'Colours'
  if (pathname.startsWith('/design-system/typography')) return 'Typography'
  if (pathname.startsWith('/design-system/buttons')) return 'Buttons'
  if (pathname.startsWith('/design-system/layout')) return 'Layout'
  if (pathname.startsWith('/design-system/components')) return 'Components'
  if (pathname.startsWith('/design-system/icons')) return 'Icons'
  if (pathname.startsWith('/design-system/heros')) return 'Heros'
  if (pathname.startsWith('/design-system')) return 'Design system'
  if (pathname.startsWith('/admin/messages')) return 'Messages'
  return 'Rail Statistics'
}

const Header: React.FC = () => {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const mobileNavId = useId()
  /** Don’t stack “log-in → migration” in history, or browser Back from migration returns to login. */
  const logoNavReplace = pathname === '/log-in'

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const isHomeActive = pathname === '/' || pathname === '/home'
  const isMigrationActive = pathname === '/migration'
  const isStationsActive = pathname.startsWith('/stations')
  const isMessagesActive = pathname.startsWith('/admin/messages')

  const pageTitle = getHeaderPageTitle(pathname)

  const navItems = [
    { to: '/home' as const, label: 'Home', active: isHomeActive, show: true },
    { to: '/migration' as const, label: 'Migration', active: isMigrationActive, show: true },
    { to: '/stations' as const, label: 'Stations', active: isStationsActive, show: Boolean(user) },
    { to: '/admin/messages' as const, label: 'Messages', active: isMessagesActive, show: Boolean(user) },
  ].filter((item) => item.show)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen])

  const closeMobileMenu = () => setMobileMenuOpen(false)
  const handleMenuToggleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setMobileMenuOpen((open) => !open)
  }

  return (
    <header className={`universal-header${mobileMenuOpen ? ' universal-header--menu-open' : ''}`}>
      {/*
        iOS Safari (esp. 26+ “Liquid Glass”): in-tab chrome tint is derived from fixed
        elements with a solid background-color near the top — not theme-color. A plain strip
        under the real header avoids backdrop-filter sampling a black/wrong tone.
        https://github.com/andesco/safari-color-tinting
      */}
      <div className="safari-toolbar-tint" aria-hidden="true" />
      <div className="header-inner">
        <div className="header-container">
          <div className="header-left">
            <BUTHeaderLink
              to="/"
              replace={logoNavReplace}
              className="logo-link logo-link--full"
              ariaLabel="Rail Statistics home"
            >
              <div className="logo">
                <span className="logo-text">Rail Statistics</span>
              </div>
            </BUTHeaderLink>
            <div className="logo logo--mobile">
              <BUTHeaderLink
                to="/"
                replace={logoNavReplace}
                className="logo-link logo-link--mobile-title"
                ariaLabel="Rail Statistics home"
              >
                <span className="header-page-title">{pageTitle}</span>
              </BUTHeaderLink>
            </div>
          </div>

          <div className="header-right">
            <nav className="header-nav header-nav--desktop" aria-label="Main">
              <div className="header-nav-links">
                {navItems.map(({ to, label, active }) => (
                  <BUTHeaderLink key={to} to={to} active={active}>
                    {label}
                  </BUTHeaderLink>
                ))}
              </div>
            </nav>
            <div
              role="button"
              tabIndex={0}
              className="header-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-controls={mobileNavId}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => {
                setMobileMenuOpen((open) => !open)
              }}
              onKeyDown={handleMenuToggleKeyDown}
            >
              <span className="header-menu-toggle__bars" aria-hidden>
                <span className="header-menu-toggle__bar" />
                <span className="header-menu-toggle__bar" />
                <span className="header-menu-toggle__bar" />
              </span>
            </div>
          </div>
        </div>

        <div
          className="header-mobile-panel"
          id={mobileNavId}
          aria-hidden={!mobileMenuOpen}
        >
          <div className="header-mobile-panel-inner" inert={mobileMenuOpen ? undefined : true}>
            <nav className="header-nav header-nav--mobile" aria-label="Main">
              <ul className="header-mobile-nav-list">
                {navItems.map(({ to, label, active }) => (
                  <li key={to}>
                    <BUTHeaderLink to={to} active={active} onClick={closeMobileMenu}>
                      {label}
                    </BUTHeaderLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
