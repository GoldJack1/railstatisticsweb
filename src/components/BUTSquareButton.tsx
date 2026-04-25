import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTSquareButtonProps = Omit<ButtonProps, 'variant' | 'shape'>

const BUTSquareButton: React.FC<BUTSquareButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="square" shape="squared" width="hug" />
}

export type { BUTSquareButtonProps }
export default BUTSquareButton
