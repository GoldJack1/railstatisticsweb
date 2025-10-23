import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button, { ButtonProps } from './Button'

export interface NavigationButtonProps extends Omit<ButtonProps, 'onClick'> {
  to: string
  replace?: boolean
  state?: any
  onClick?: () => void
  isActive?: boolean
}

const NavigationButton: React.FC<NavigationButtonProps> = ({
  to,
  replace = false,
  state,
  onClick,
  isActive = false,
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
      pressed={isNavigating || isActive}
      disabled={buttonProps.disabled || isNavigating}
    />
  )
}

export default NavigationButton
