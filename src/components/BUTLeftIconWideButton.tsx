import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTLeftIconWideButtonProps = Omit<ButtonProps, 'variant' | 'iconPosition'>

const BUTLeftIconWideButton: React.FC<BUTLeftIconWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" iconPosition="left" />
}

export type { BUTLeftIconWideButtonProps }
export default BUTLeftIconWideButton
