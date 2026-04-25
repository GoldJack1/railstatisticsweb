import React from 'react'
import BUTBaseButton, { type ButtonProps } from '../base/BUTBaseButton/BUTBaseButton'

type BUTTabButtonProps = Omit<ButtonProps, 'variant'>

const BUTTabButton: React.FC<BUTTabButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="tab" />
}

export type { BUTTabButtonProps }
export default BUTTabButton
