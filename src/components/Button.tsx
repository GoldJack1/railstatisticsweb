import React, { useState } from 'react'
import './Button.css'

export type ButtonVariant = 'wide' | 'circle' | 'square' | 'tab' | 'chip'
export type ButtonShape = 'rounded' | 'left-rounded' | 'right-rounded' | 'top-rounded' | 'bottom-rounded' | 'squared'
export type ButtonState = 'active' | 'pressed' | 'disabled'
export type ButtonWidth = 'fixed' | 'hug' | 'fill'
export type ButtonType = 'button' | 'submit' | 'reset'

export interface ButtonProps {
  variant?: ButtonVariant
  shape?: ButtonShape
  state?: ButtonState
  width?: ButtonWidth
  type?: ButtonType
  disabled?: boolean
  pressed?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
  ariaLabel?: string
}

const Button: React.FC<ButtonProps> = ({
  variant = 'wide',
  shape = 'rounded',
  state,
  width = 'fixed',
  type = 'button',
  disabled = false,
  pressed = false,
  icon,
  children,
  onClick,
  className = '',
  ariaLabel
}) => {
  const [isPressed, setIsPressed] = useState(false)
  
  // Determine the actual state
  const actualState: ButtonState = state || (disabled ? 'disabled' : (pressed || isPressed) ? 'pressed' : 'active')
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !onClick) return

    // Never delay form submission/reset actions.
    if (type !== 'button') {
      onClick(event)
      return
    }

    // Show pressed state
    setIsPressed(true)

    // Wait for animation, then trigger action and release
    setTimeout(() => {
      onClick(event)
      setIsPressed(false)
    }, 300)
  }

  const buttonClasses = [
    'rs-button',
    `rs-button--${variant}`,
    `rs-button--${shape}`,
    `rs-button--${actualState}`,
    width && `rs-button--width-${width}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      className={buttonClasses}
      type={type}
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

