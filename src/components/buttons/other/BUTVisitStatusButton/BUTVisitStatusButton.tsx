import React from 'react'
import { BUTSharedNativeButton } from '../../base/BUTBaseButton/BUTBaseButton'
import './BUTVisitStatusButton.css'

export interface BUTVisitStatusButtonProps {
  visited: boolean
  date?: string
  onToggle?: () => void
  disabled?: boolean
  className?: string
}

const BUTVisitStatusButton: React.FC<BUTVisitStatusButtonProps> = ({
  visited,
  date,
  onToggle,
  disabled = false,
  className = ''
}) => {
  const buttonClasses = [
    'rs-visit-button',
    visited ? 'rs-visit-button--visited' : 'rs-visit-button--not-visited',
    disabled ? 'rs-visit-button--disabled' : '',
    className
  ].filter(Boolean).join(' ')

  const displayText = visited ? (date ? `Visited on ${date}` : 'Visited') : 'Not Visited'

  return (
    <BUTSharedNativeButton className={buttonClasses} onClick={onToggle} disabled={disabled} aria-label={displayText}>
      <span className="rs-visit-button__text">{displayText}</span>
      <div className="rs-visit-button__inner-shadow" aria-hidden="true" />
    </BUTSharedNativeButton>
  )
}

export default BUTVisitStatusButton
