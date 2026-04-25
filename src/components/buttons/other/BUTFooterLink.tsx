import React from 'react'
import { Link } from 'react-router-dom'

type BUTFooterLinkBaseProps = {
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}

type BUTFooterRouteLinkProps = BUTFooterLinkBaseProps & {
  to: string
  onActivate?: never
}

type BUTFooterActionLinkProps = BUTFooterLinkBaseProps & {
  to?: never
  onActivate: () => void
}

type BUTFooterLinkProps = BUTFooterRouteLinkProps | BUTFooterActionLinkProps

const BUTFooterLink: React.FC<BUTFooterLinkProps> = ({ children, className = '', ariaLabel, ...rest }) => {
  const composedClassName = `site-footer-link ${className}`.trim()
  const routeTarget = (rest as BUTFooterRouteLinkProps).to
  const onActivate = (rest as BUTFooterActionLinkProps).onActivate

  if (typeof routeTarget === 'string') {
    return (
      <Link to={routeTarget} className={composedClassName} aria-label={ariaLabel}>
        {children}
      </Link>
    )
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (onActivate) onActivate()
  }

  return (
    <a
      href="#"
      role="button"
      className={composedClassName}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.preventDefault()
        if (onActivate) onActivate()
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </a>
  )
}

export type { BUTFooterLinkProps }
export default BUTFooterLink

