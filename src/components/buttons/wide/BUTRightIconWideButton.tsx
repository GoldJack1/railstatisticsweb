import React from 'react'
import BUTBaseButton, { type ButtonProps } from '../base/BUTBaseButton/BUTBaseButton'

type BUTRightIconWideButtonProps = Omit<ButtonProps, 'variant' | 'iconPosition'>

const BUTRightIconWideButton: React.FC<BUTRightIconWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" iconPosition="right" />
}

export type { BUTRightIconWideButtonProps }
export default BUTRightIconWideButton
