import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTCircleButtonProps = Omit<ButtonProps, 'variant'>

const BUTCircleButton: React.FC<BUTCircleButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="circle" />
}

export type { BUTCircleButtonProps }
export default BUTCircleButton
