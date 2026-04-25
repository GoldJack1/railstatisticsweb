import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTRightconWideButtonProps = Omit<ButtonProps, 'variant' | 'iconPosition'>

const BUTRightconWideButton: React.FC<BUTRightconWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" iconPosition="right" />
}

export type { BUTRightconWideButtonProps }
export default BUTRightconWideButton
