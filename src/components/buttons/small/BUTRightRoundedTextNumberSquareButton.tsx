import React from 'react'
import BUTTextNumberSquareButton, { type BUTTextNumberSquareButtonProps } from './BUTTextNumberSquareButton'

type BUTRightRoundedTextNumberSquareButtonProps = Omit<BUTTextNumberSquareButtonProps, 'shape'>

const BUTRightRoundedTextNumberSquareButton: React.FC<BUTRightRoundedTextNumberSquareButtonProps> = (props) => {
  return <BUTTextNumberSquareButton {...props} shape="right-rounded" />
}

export type { BUTRightRoundedTextNumberSquareButtonProps }
export default BUTRightRoundedTextNumberSquareButton
