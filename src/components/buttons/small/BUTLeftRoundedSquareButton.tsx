import React from 'react'
import BUTSquareButton, { type BUTSquareButtonProps } from './BUTSquareButton'

type BUTLeftRoundedSquareButtonProps = Omit<BUTSquareButtonProps, 'shape'>

const BUTLeftRoundedSquareButton: React.FC<BUTLeftRoundedSquareButtonProps> = (props) => {
  return <BUTSquareButton {...props} shape="left-rounded" />
}

export type { BUTLeftRoundedSquareButtonProps }
export default BUTLeftRoundedSquareButton
