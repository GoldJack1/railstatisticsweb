import React from 'react'
import BUTTextNumberSquareButton, { type BUTTextNumberSquareButtonProps } from './BUTTextNumberSquareButton'

type BUTLeftRoundedTextNumberSquareButtonProps = Omit<BUTTextNumberSquareButtonProps, 'shape'>

const BUTLeftRoundedTextNumberSquareButton: React.FC<BUTLeftRoundedTextNumberSquareButtonProps> = (props) => {
  return <BUTTextNumberSquareButton {...props} shape="left-rounded" />
}

export type { BUTLeftRoundedTextNumberSquareButtonProps }
export default BUTLeftRoundedTextNumberSquareButton
