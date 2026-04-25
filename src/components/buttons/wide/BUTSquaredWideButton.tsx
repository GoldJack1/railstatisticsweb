import React from 'react'
import BUTBaseButton, { type ButtonProps } from '../base/BUTBaseButton/BUTBaseButton'

type BUTSquaredWideButtonProps = Omit<ButtonProps, 'variant' | 'shape'>

const BUTSquaredWideButton: React.FC<BUTSquaredWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" shape="squared" />
}

export type { BUTSquaredWideButtonProps }
export default BUTSquaredWideButton
