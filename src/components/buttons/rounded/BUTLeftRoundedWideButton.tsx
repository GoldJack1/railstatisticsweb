import React from 'react'
import BUTBaseButton, { type ButtonProps } from '../base/BUTBaseButton/BUTBaseButton'

type BUTLeftRoundedWideButtonProps = Omit<ButtonProps, 'variant' | 'shape'>

const BUTLeftRoundedWideButton: React.FC<BUTLeftRoundedWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" shape="left-rounded" />
}

export type { BUTLeftRoundedWideButtonProps }
export default BUTLeftRoundedWideButton
