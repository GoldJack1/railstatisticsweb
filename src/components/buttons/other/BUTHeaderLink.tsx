import React from 'react'
import { Link } from 'react-router-dom'

interface BUTHeaderLinkProps {
  to: string
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
  className?: string
  ariaLabel?: string
  replace?: boolean
}

const BUTHeaderLink: React.FC<BUTHeaderLinkProps> = ({
  to,
  active = false,
  children,
  onClick,
  className = '',
  ariaLabel,
  replace = false,
}) => {
  const classes = `header-nav-link${active ? ' header-nav-link--active' : ''} ${className}`.trim()

  return (
    <Link
      to={to}
      replace={replace}
      className={classes}
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

export type { BUTHeaderLinkProps }
export default BUTHeaderLink

