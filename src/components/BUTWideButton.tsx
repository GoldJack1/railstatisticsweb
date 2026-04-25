import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTWideButtonProps = Omit<ButtonProps, 'variant'> & {
  to?: string
  replace?: boolean
  navigationState?: unknown
  onNavigate?: () => void
  isActive?: boolean
}

const BUTWideButton: React.FC<BUTWideButtonProps> = ({
  to,
  replace = false,
  navigationState,
  onNavigate,
  isActive = false,
  onClick,
  pressed,
  disabled,
  ...props
}) => {
  const [isNavigating, setIsNavigating] = useState(false)
  const navigate = useNavigate()

  const handleNavigateClick = () => {
    if (!to || disabled || isNavigating) return
    setIsNavigating(true)
    onNavigate?.()
    setTimeout(() => {
      navigate(to, { replace, state: navigationState })
      setIsNavigating(false)
    }, 300)
  }

  return (
    <BUTBaseButton
      {...props}
      variant="wide"
      onClick={to ? () => handleNavigateClick() : onClick}
      pressed={pressed || isActive || isNavigating}
      disabled={disabled || isNavigating}
    />
  )
}

export type { BUTWideButtonProps }
export default BUTWideButton
