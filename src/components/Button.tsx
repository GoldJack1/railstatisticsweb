import React from 'react'
import './Button.css'

export type ButtonVariant = 'wide' | 'circle' | 'square' | 'tab' | 'chip'
export type ButtonShape = 'rounded' | 'left-rounded' | 'right-rounded' | 'top-rounded' | 'bottom-rounded' | 'squared'
export type ButtonState = 'active' | 'pressed' | 'disabled'

export interface ButtonProps {
  variant?: ButtonVariant
  shape?: ButtonShape
  state?: ButtonState
  disabled?: boolean
  pressed?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
  onClick?: () => void
  className?: string
  ariaLabel?: string
}

const Button: React.FC<ButtonProps> = ({
  variant = 'wide',
  shape = 'rounded',
  state,
  disabled = false,
  pressed = false,
  icon,
  children,
  onClick,
  className = '',
  ariaLabel
}) => {
  // Determine the actual state
  const actualState: ButtonState = state || (disabled ? 'disabled' : pressed ? 'pressed' : 'active')
  
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
    }
  }

  const buttonClasses = [
    'rs-button',
    `rs-button--${variant}`,
    `rs-button--${shape}`,
    `rs-button--${actualState}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {icon && <span className="rs-button__icon">{icon}</span>}
      {children && <span className="rs-button__text">{children}</span>}
      <div className="rs-button__inner-shadow" aria-hidden="true" />
    </button>
  )
}

export default Button

