import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTWideButtonProps = Omit<ButtonProps, 'variant'>

const BUTWideButton: React.FC<BUTWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" />
}

export type { BUTWideButtonProps }
export default BUTWideButton
