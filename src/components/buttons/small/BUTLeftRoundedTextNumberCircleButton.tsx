import React from 'react'
import BUTTextNumberCircleButton, { type BUTTextNumberCircleButtonProps } from './BUTTextNumberCircleButton'

type BUTLeftRoundedTextNumberCircleButtonProps = Omit<BUTTextNumberCircleButtonProps, 'shape'>

const BUTLeftRoundedTextNumberCircleButton: React.FC<BUTLeftRoundedTextNumberCircleButtonProps> = (props) => {
  return <BUTTextNumberCircleButton {...props} shape="left-rounded" />
}

export type { BUTLeftRoundedTextNumberCircleButtonProps }
export default BUTLeftRoundedTextNumberCircleButton
