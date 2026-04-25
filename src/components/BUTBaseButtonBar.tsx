import React, { useState } from 'react'
import { BUTSharedNativeButton } from './BUTBaseButton'
import './ButtonBar.css'
import type { ButtonColorVariant } from './BUTBaseButton'

export interface ButtonBarItem {
  label: string
  value: string
  disabled?: boolean
  id?: string
}

export interface ButtonBarProps {
  buttons: ButtonBarItem[]
  selectedIndex?: number | null
  onChange?: (index: number | null, value: string | null) => void
  colorVariant?: ButtonColorVariant
  className?: string
}

const BUTBaseButtonBar: React.FC<ButtonBarProps> = ({
  buttons,
  selectedIndex: controlledIndex,
  onChange,
  colorVariant = 'primary',
  className = ''
}) => {
  const [internalIndex, setInternalIndex] = useState<number | null>(null)
  const pressedIndex = controlledIndex !== undefined ? controlledIndex : internalIndex

  const handleClick = (index: number, value: string, disabled?: boolean) => {
    if (disabled) return
    const newIndex = pressedIndex === index ? null : index
    const newValue = newIndex === null ? null : value
    if (controlledIndex === undefined) {
      setInternalIndex(newIndex)
    }
    onChange?.(newIndex, newValue)
  }

  const buttonCount = buttons.length
  const barClasses = [
    'rs-button-bar',
    `rs-button-bar--${buttonCount}`,
    `rs-button-bar--color-${colorVariant}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={barClasses}>
      {buttons.map((button, index) => {
        const isPressed = pressedIndex === index
        const isFirst = index === 0
        const isLast = index === buttons.length - 1

        let shape = 'squared'
        if (isFirst && !isLast) shape = 'left-rounded'
        if (!isFirst && isLast) shape = 'right-rounded'

        const buttonClasses = [
          'rs-button-bar__button',
          isPressed ? 'rs-button-bar__button--pressed' : '',
          button.disabled ? 'rs-button-bar__button--disabled' : '',
          `rs-button-bar__button--${shape}`
        ].filter(Boolean).join(' ')

        return (
          <div key={button.value} className="rs-button-bar__item">
            <BUTSharedNativeButton
              type="button"
              id={button.id}
              className={buttonClasses}
              onClick={() => handleClick(index, button.value, button.disabled)}
              disabled={button.disabled}
            >
              <span className="rs-button-bar__text">{button.label}</span>
              <div className="rs-button-bar__inner-shadow" aria-hidden="true" />
            </BUTSharedNativeButton>
          </div>
        )
      })}
    </div>
  )
}

export default BUTBaseButtonBar
