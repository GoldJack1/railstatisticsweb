import React from 'react'
import { BUTSharedNativeButton } from '../../base/BUTBaseButton/BUTBaseButton'
import type { ButtonColorVariant } from '../../base/BUTBaseButton/BUTBaseButton'
import './TOGToggle.css'

export interface TOGToggleProps {
  checked: boolean
  onChange?: (next: boolean) => void
  trackOffColor?: string
  trackOnColor?: string
  knobColor?: string
  colorVariant?: ButtonColorVariant
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

const TOGToggle: React.FC<TOGToggleProps> = ({
  checked,
  onChange,
  trackOffColor,
  trackOnColor,
  knobColor,
  colorVariant,
  disabled = false,
  ariaLabel = 'Toggle',
  className = '',
}) => {
  const handleToggle = () => {
    if (disabled) return
    onChange?.(!checked)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onChange?.(!checked)
    }
  }

  const styles: React.CSSProperties = {
    ...(trackOffColor ? ({ '--tog-track-off': trackOffColor } as React.CSSProperties) : null),
    ...(trackOnColor ? ({ '--tog-track-on': trackOnColor } as React.CSSProperties) : null),
    ...(knobColor ? ({ '--tog-knob-color': knobColor } as React.CSSProperties) : null),
  }

  const buttonClasses = [
    'rs-tog-toggle',
    colorVariant ? `rs-button--color-${colorVariant}` : '',
    checked ? 'is-on' : '',
    disabled ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <BUTSharedNativeButton
      className={buttonClasses}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      style={styles}
    >
      <span className="rs-tog-toggle__track" aria-hidden="true" />
      <span className="rs-tog-toggle__knob" aria-hidden="true" />
    </BUTSharedNativeButton>
  )
}

export default TOGToggle
