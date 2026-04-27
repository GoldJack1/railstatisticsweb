import React, { useEffect, useRef, useState } from 'react'
import './TextCard.css'

export type TextCardState = 'default' | 'accent' | 'redAction' | 'greenAction'

export interface TextCardProps {
  title: string
  description: string
  state?: TextCardState
  onClick?: () => void
  trailingIcon?: React.ReactNode
  disabled?: boolean
  pressed?: boolean
  className?: string
  ariaLabel?: string
}

const DefaultChevron: React.FC = () => (
  <svg
    className="rs-text-card__chevron-svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M6 3.5L10 8L6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TextCard: React.FC<TextCardProps> = ({
  title,
  description,
  state = 'default',
  onClick,
  trailingIcon,
  disabled = false,
  pressed = false,
  className = '',
  ariaLabel
}) => {
  const [isPressed, setIsPressed] = useState(false)
  const releaseTimerRef = useRef<number | null>(null)

  const clearReleaseTimer = () => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = null
    }
  }

  const scheduleRelease = () => {
    clearReleaseTimer()
    releaseTimerRef.current = window.setTimeout(() => {
      setIsPressed(false)
      releaseTimerRef.current = null
    }, 300)
  }

  const handlePressStart = () => {
    if (disabled) return
    clearReleaseTimer()
    setIsPressed(true)
  }

  const handlePressEnd = () => {
    if (disabled) return
    scheduleRelease()
  }

  const handleClick = () => {
    if (disabled) return
    onClick?.()
  }

  useEffect(() => () => clearReleaseTimer(), [])

  const actualPressed = !disabled && (pressed || isPressed)
  const classes = [
    'rs-text-card',
    `rs-text-card--state-${state}`,
    actualPressed ? 'rs-text-card--pressed' : 'rs-text-card--active',
    disabled ? 'rs-text-card--disabled' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressEnd}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') handlePressStart()
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') handlePressEnd()
      }}
      onClick={handleClick}
      aria-label={ariaLabel ?? title}
    >
      <span className="rs-text-card__content">
        <span className="rs-text-card__title">{title}</span>
        <span className="rs-text-card__description">{description}</span>
      </span>
      <span className="rs-text-card__chevron">{trailingIcon ?? <DefaultChevron />}</span>
      <span className="rs-text-card__inner-shadow" aria-hidden="true" />
    </button>
  )
}

export default TextCard
