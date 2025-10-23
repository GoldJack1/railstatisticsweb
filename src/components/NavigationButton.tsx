import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button, { ButtonProps } from './Button'

export interface NavigationButtonProps extends Omit<ButtonProps, 'onClick'> {
  to: string
  replace?: boolean
  state?: any
  onClick?: () => void
}

const NavigationButton: React.FC<NavigationButtonProps> = ({
  to,
  replace = false,
  state,
  onClick,
  ...buttonProps
}) => {
  const [isNavigating, setIsNavigating] = useState(false)
  const navigate = useNavigate()

  const handleClick = () => {
    if (isNavigating) return // Prevent multiple clicks during navigation
    
    // Show pressed state
    setIsNavigating(true)
    
    // Call custom onClick if provided
    if (onClick) {
      onClick()
    }
    
    // Wait for press animation, then navigate
    setTimeout(() => {
      navigate(to, { replace, state })
      setIsNavigating(false)
    }, 300)
  }

  return (
    <Button
      {...buttonProps}
      onClick={handleClick}
      pressed={isNavigating}
      disabled={buttonProps.disabled || isNavigating}
    />
  )
}

export default NavigationButton
