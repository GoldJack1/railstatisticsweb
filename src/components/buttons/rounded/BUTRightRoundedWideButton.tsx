import React from 'react'
import BUTBaseButton, { type ButtonProps } from '../base/BUTBaseButton/BUTBaseButton'

type BUTRightRoundedWideButtonProps = Omit<ButtonProps, 'variant' | 'shape'>

const BUTRightRoundedWideButton: React.FC<BUTRightRoundedWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" shape="right-rounded" />
}

export type { BUTRightRoundedWideButtonProps }
export default BUTRightRoundedWideButton
