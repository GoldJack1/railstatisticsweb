import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BUTMappedButton from './BUTMappedButton'
import type { ButtonProps } from './BUTBaseButton'

export interface NavigationButtonProps extends Omit<ButtonProps, 'onClick' | 'state'> {
  to: string
  replace?: boolean
  state?: unknown
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
    <BUTMappedButton
      {...buttonProps}
      onClick={handleClick}
      pressed={isNavigating || isActive}
      disabled={buttonProps.disabled || isNavigating}
    />
  )
}

export default NavigationButton
