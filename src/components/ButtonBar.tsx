import React, { useState } from 'react'
import './ButtonBar.css'

export interface ButtonBarItem {
  label: string
  value: string
  disabled?: boolean
}

export interface ButtonBarProps {
  buttons: ButtonBarItem[]
  selectedIndex?: number | null
  onChange?: (index: number | null, value: string | null) => void
  className?: string
}

const ButtonBar: React.FC<ButtonBarProps> = ({
  buttons,
  selectedIndex: controlledIndex,
  onChange,
  className = ''
}) => {
  // Track which button is currently pressed (only one at a time, or null for none)
  const [internalIndex, setInternalIndex] = useState<number | null>(null)
  const pressedIndex = controlledIndex !== undefined ? controlledIndex : internalIndex

  const handleClick = (index: number, value: string, disabled?: boolean) => {
    if (disabled) return
    
    // If clicking the already pressed button, toggle it off
    const newIndex = pressedIndex === index ? null : index
    const newValue = newIndex === null ? null : value
    
    if (controlledIndex === undefined) {
      setInternalIndex(newIndex)
    }
    
    if (onChange) {
      onChange(newIndex, newValue)
    }
  }

  const buttonCount = buttons.length
  const barClasses = [
    'rs-button-bar',
    `rs-button-bar--${buttonCount}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={barClasses}>
      {buttons.map((button, index) => {
        // Only the selected button is pressed, all others are active
        const isPressed = pressedIndex === index
        const isFirst = index === 0
        const isLast = index === buttons.length - 1

        let shape = 'squared'
        if (isFirst && isLast) {
          shape = 'squared'
        } else if (isFirst) {
          shape = 'left-rounded'
        } else if (isLast) {
          shape = 'right-rounded'
        }

        const buttonClasses = [
          'rs-button-bar__button',
          isPressed ? 'rs-button-bar__button--pressed' : '',
          button.disabled ? 'rs-button-bar__button--disabled' : '',
          `rs-button-bar__button--${shape}`
        ].filter(Boolean).join(' ')

        return (
          <div key={button.value} className="rs-button-bar__item">
            <button
              className={buttonClasses}
              onClick={() => handleClick(index, button.value, button.disabled)}
              disabled={button.disabled}
            >
              <span className="rs-button-bar__text">{button.label}</span>
              <div className="rs-button-bar__inner-shadow" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default ButtonBar

