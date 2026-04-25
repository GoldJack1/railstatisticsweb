import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTTabButtonProps = Omit<ButtonProps, 'variant'>

const BUTTabButton: React.FC<BUTTabButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="tab" />
}

export type { BUTTabButtonProps }
export default BUTTabButton
