import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import NavigationButton from './NavigationButton'
import Button from './Button'
import './Header.css'

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <header className="universal-header">
      <div className="header-container">
        <div className="header-left">
          <Link to="/" className="logo-link" onClick={closeMobileMenu}>
            <div className="logo">
              Rail Statistics
            </div>
          </Link>
        </div>
        
        <div className="header-right">
          <nav className="header-nav desktop-nav">
            <NavigationButton 
              to="/migration" 
              variant="wide" 
              width="hug"
              isActive={location.pathname === '/' || location.pathname === '/migration'}
            >
              Migration
            </NavigationButton>
          </nav>
          
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
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
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
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )
            }
          />
          
          <Button
            variant="circle"
            onClick={toggleMobileMenu}
            ariaLabel="Toggle navigation menu"
            className="mobile-menu-button"
            icon={
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={`hamburger-icon ${mobileMenuOpen ? 'active' : ''}`}
              >
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            }
          />
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {isMobile && (
        <nav className={`mobile-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <NavigationButton 
            to="/" 
            variant="wide" 
            width="fill" 
            onClick={closeMobileMenu}
            isActive={location.pathname === '/' || location.pathname === '/migration'}
          >
            Migration
          </NavigationButton>
        </nav>
      )}
    </header>
  )
}

export default Header