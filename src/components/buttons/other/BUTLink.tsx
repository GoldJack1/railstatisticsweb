import React from 'react'
import { Link } from 'react-router-dom'

export type BUTLinkTarget = React.HTMLAttributeAnchorTarget
export type BUTLinkClickEvent = React.MouseEvent<HTMLAnchorElement>

interface BUTLinkProps {
  to?: string
  href?: string
  className?: string
  children: React.ReactNode
  onClick?: (event: BUTLinkClickEvent) => void
  ariaLabel?: string
  title?: string
  target?: BUTLinkTarget
  rel?: string
}

const BUTLink: React.FC<BUTLinkProps> = ({
  to,
  href,
  className = '',
  children,
  onClick,
  ariaLabel,
  title,
  target,
  rel,
}) => {
  if (to) {
    return (
      <Link to={to} className={className} onClick={onClick} aria-label={ariaLabel} title={title}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a
        href={href}
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
        title={title}
        target={target}
        rel={rel}
      >
        {children}
      </a>
    )
  }

  return <span className={className}>{children}</span>
}

export type { BUTLinkProps }
export default BUTLink

