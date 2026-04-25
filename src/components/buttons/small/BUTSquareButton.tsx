import React from 'react'
import BUTBaseButton, { type ButtonProps, type ButtonShape } from '../base/BUTBaseButton/BUTBaseButton'

type BUTSquareShape = Extract<ButtonShape, 'squared' | 'left-rounded' | 'right-rounded'>
type BUTSquareButtonProps = Omit<ButtonProps, 'variant' | 'shape'> & {
  shape?: BUTSquareShape
}

const BUTSquareButton: React.FC<BUTSquareButtonProps> = ({ shape = 'squared', ...props }) => {
  return <BUTBaseButton {...props} variant="square" shape={shape} width="hug" />
}

export type { BUTSquareButtonProps }
export default BUTSquareButton
