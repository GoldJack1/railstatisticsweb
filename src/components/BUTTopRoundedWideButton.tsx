import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTTopRoundedWideButtonProps = Omit<ButtonProps, 'variant' | 'shape'>

const BUTTopRoundedWideButton: React.FC<BUTTopRoundedWideButtonProps> = (props) => {
  return <BUTBaseButton {...props} variant="wide" shape="top-rounded" />
}

export type { BUTTopRoundedWideButtonProps }
export default BUTTopRoundedWideButton
