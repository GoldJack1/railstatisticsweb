import React from 'react'
import './SelectionDot.css'

export interface SelectionDotProps {
  selected: boolean
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

const SelectionDot: React.FC<SelectionDotProps> = ({
  selected,
  disabled = false,
  className = '',
  ariaLabel
}) => {
  const classes = [
    'rs-selection-dot',
    selected ? 'rs-selection-dot--selected' : 'rs-selection-dot--unselected',
    disabled ? 'rs-selection-dot--disabled' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <span
      className={classes}
      role="img"
      aria-label={ariaLabel ?? (selected ? 'Selected option' : 'Unselected option')}
    >
      <span className="rs-selection-dot__inner" aria-hidden="true" />
    </span>
  )
}

export default SelectionDot
