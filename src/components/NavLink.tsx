import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

interface NavLinkProps {
  to: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
  replace?: boolean
  state?: any
}

const NavLink: React.FC<NavLinkProps> = ({
  to,
  children,
  className = '',
  onClick,
  replace = false,
  state
}) => {
  const [isNavigating, setIsNavigating] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = location.pathname === to
  const activeClass = isActive ? 'active' : ''
  const pressedClass = isNavigating ? 'pressed' : ''

  const handleClick = (e: React.MouseEvent) => {
    if (isNavigating) {
      e.preventDefault()
      return
    }

    // Call custom onClick if provided
    if (onClick) {
      onClick()
    }

    // Show pressed state
    setIsNavigating(true)
    
    // Wait for press animation, then navigate
    setTimeout(() => {
      navigate(to, { replace, state })
      setIsNavigating(false)
    }, 300)
  }

  return (
    <Link
      to={to}
      className={`nav-link ${activeClass} ${pressedClass} ${className}`.trim()}
      onClick={handleClick}
    >
      {children}
    </Link>
  )
}

export default NavLink
