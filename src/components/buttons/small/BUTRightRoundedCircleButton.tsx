import React from 'react'
import BUTCircleButton, { type BUTCircleButtonProps } from './BUTCircleButton'

type BUTRightRoundedCircleButtonProps = Omit<BUTCircleButtonProps, 'shape'>

const BUTRightRoundedCircleButton: React.FC<BUTRightRoundedCircleButtonProps> = (props) => {
  return <BUTCircleButton {...props} shape="right-rounded" />
}

export type { BUTRightRoundedCircleButtonProps }
export default BUTRightRoundedCircleButton
