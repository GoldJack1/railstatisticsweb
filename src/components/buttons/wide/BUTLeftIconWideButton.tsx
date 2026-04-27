import React from 'react'
import { useNavigate } from 'react-router-dom'
import BUTBaseButton, { type ButtonProps } from '../base/BUTBaseButton/BUTBaseButton'

type BUTLeftIconWideButtonProps = Omit<ButtonProps, 'variant' | 'iconPosition'> & {
  to?: string
  replace?: boolean
  navigationState?: unknown
  onNavigate?: () => void
}

const BUTLeftIconWideButton: React.FC<BUTLeftIconWideButtonProps> = ({
  to,
  replace = false,
  navigationState,
  onNavigate,
  onClick,
  disabled,
  ...props
}) => {
  const navigate = useNavigate()

  const handleNavigateClick = () => {
    if (!to || disabled) return
    onNavigate?.()
    setTimeout(() => {
      navigate(to, { replace, state: navigationState })
    }, 300)
  }

  return (
    <BUTBaseButton
      {...props}
      variant="wide"
      iconPosition="left"
      disabled={disabled}
      onClick={to ? () => handleNavigateClick() : onClick}
    />
  )
}

export type { BUTLeftIconWideButtonProps }
export default BUTLeftIconWideButton
