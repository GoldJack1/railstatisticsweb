import React from 'react'
import { Link } from 'react-router-dom'

interface BUTHeaderLinkProps {
  to: string
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}

const BUTHeaderLink: React.FC<BUTHeaderLinkProps> = ({ to, active = false, children, onClick }) => {
  return (
    <Link
      to={to}
      className={`header-nav-link${active ? ' header-nav-link--active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  )
}

export type { BUTHeaderLinkProps }
export default BUTHeaderLink

