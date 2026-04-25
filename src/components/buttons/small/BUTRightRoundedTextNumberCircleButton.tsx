import React from 'react'
import BUTTextNumberCircleButton, { type BUTTextNumberCircleButtonProps } from './BUTTextNumberCircleButton'

type BUTRightRoundedTextNumberCircleButtonProps = Omit<BUTTextNumberCircleButtonProps, 'shape'>

const BUTRightRoundedTextNumberCircleButton: React.FC<BUTRightRoundedTextNumberCircleButtonProps> = (props) => {
  return <BUTTextNumberCircleButton {...props} shape="right-rounded" />
}

export type { BUTRightRoundedTextNumberCircleButtonProps }
export default BUTRightRoundedTextNumberCircleButton
