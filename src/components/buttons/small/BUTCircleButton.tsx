import React from 'react'
import BUTBaseButton, { type ButtonProps, type ButtonShape } from '../base/BUTBaseButton/BUTBaseButton'

type BUTCircleShape = Extract<ButtonShape, 'rounded' | 'left-rounded' | 'right-rounded'>
type BUTCircleButtonProps = Omit<ButtonProps, 'variant' | 'shape'> & {
  shape?: BUTCircleShape
}

const BUTCircleButton: React.FC<BUTCircleButtonProps> = ({ shape = 'rounded', ...props }) => {
  return <BUTBaseButton {...props} variant="circle" shape={shape} />
}

export type { BUTCircleButtonProps }
export default BUTCircleButton
