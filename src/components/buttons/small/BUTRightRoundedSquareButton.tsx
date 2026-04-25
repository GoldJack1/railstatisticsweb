import React from 'react'
import BUTSquareButton, { type BUTSquareButtonProps } from './BUTSquareButton'

type BUTRightRoundedSquareButtonProps = Omit<BUTSquareButtonProps, 'shape'>

const BUTRightRoundedSquareButton: React.FC<BUTRightRoundedSquareButtonProps> = (props) => {
  return <BUTSquareButton {...props} shape="right-rounded" />
}

export type { BUTRightRoundedSquareButtonProps }
export default BUTRightRoundedSquareButton
