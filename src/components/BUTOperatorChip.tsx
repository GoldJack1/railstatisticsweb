import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTOperatorChipProps = Omit<ButtonProps, 'variant'>

const BUTOperatorChip: React.FC<BUTOperatorChipProps> = (props) => {
  return <BUTBaseButton {...props} variant="chip" />
}

export type { BUTOperatorChipProps }
export default BUTOperatorChip
