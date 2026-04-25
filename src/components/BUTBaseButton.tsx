import React, { useState } from 'react'
import BUTLink from './BUTLink'
import './Button.css'

export type ButtonVariant = 'wide' | 'circle' | 'square' | 'tab' | 'chip'
export type ButtonShape = 'rounded' | 'left-rounded' | 'right-rounded' | 'top-rounded' | 'bottom-rounded' | 'squared'
export type ButtonState = 'active' | 'pressed' | 'disabled'
export type ButtonWidth = 'fixed' | 'hug' | 'fill'
export type ButtonType = 'button' | 'submit' | 'reset'
export type ButtonColorVariant = 'primary' | 'secondary' | 'accent' | 'green-action' | 'red-action'
export type ButtonIconPosition = 'left' | 'right'

export interface ButtonProps {
  variant?: ButtonVariant
  shape?: ButtonShape
  state?: ButtonState
  colorVariant?: ButtonColorVariant
  width?: ButtonWidth
  type?: ButtonType
  disabled?: boolean
  pressed?: boolean
  icon?: React.ReactNode
  iconPosition?: ButtonIconPosition
  children?: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  className?: string
  ariaLabel?: string
  title?: string
  href?: string
  target?: React.HTMLAttributeAnchorTarget
  rel?: string
  form?: string
  instantAction?: boolean
}

export type BUTSharedNativeButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode
}

export const BUTSharedNativeButton: React.FC<BUTSharedNativeButtonProps> = ({
  children,
  type = 'button',
  ...rest
}) => {
  return (
    <button type={type} {...rest}>
      {children}
    </button>
  )
}

const BUTBaseButton: React.FC<ButtonProps> = ({
  variant = 'wide',
  shape = 'rounded',
  state,
  colorVariant = 'primary',
  width = 'fixed',
  type = 'button',
  disabled = false,
  pressed = false,
  icon,
  iconPosition = 'left',
  children,
  onClick,
  className = '',
  ariaLabel,
  title,
  form,
  instantAction = false,
  href,
  target = '_blank',
  rel = 'noopener noreferrer'
}) => {
  const [isPressed, setIsPressed] = useState(false)
  const actualState: ButtonState = state || (disabled ? 'disabled' : (pressed || isPressed) ? 'pressed' : 'active')

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (type !== 'button') {
      onClick?.(event)
      return
    }
    if (!onClick) return
    if (instantAction) {
      onClick(event)
      return
    }
    setIsPressed(true)
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
    `rs-button--color-${colorVariant}`,
    icon && `rs-button--icon-${iconPosition}`,
    width && `rs-button--width-${width}`,
    className
  ].filter(Boolean).join(' ')

  if (href) {
    return (
      <BUTLink
        className={buttonClasses}
        href={href}
        target={target}
        rel={rel}
        ariaLabel={ariaLabel}
        title={title}
      >
        {icon && <span className="rs-button__icon">{icon}</span>}
        {children && <span className="rs-button__text">{children}</span>}
        <div className="rs-button__inner-shadow" aria-hidden="true" />
      </BUTLink>
    )
  }

  return (
    <BUTSharedNativeButton
      className={buttonClasses}
      type={type}
      form={form}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
    >
      {icon && <span className="rs-button__icon">{icon}</span>}
      {children && <span className="rs-button__text">{children}</span>}
      <div className="rs-button__inner-shadow" aria-hidden="true" />
    </BUTSharedNativeButton>
  )
}

export default BUTBaseButton
