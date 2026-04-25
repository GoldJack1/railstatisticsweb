import React from 'react'
import BUTBaseButton, { type ButtonProps } from '../base/BUTBaseButton/BUTBaseButton'

type BUTBottomRoundedWideButtonProps = Omit<ButtonProps, 'variant' | 'shape'>

const BUTBottomRoundedWideButton: React.FC<BUTBottomRoundedWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" shape="bottom-rounded" />
}

export type { BUTBottomRoundedWideButtonProps }
export default BUTBottomRoundedWideButton
