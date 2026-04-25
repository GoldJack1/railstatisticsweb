import React from 'react'
import BUTCircleButton, { type BUTCircleButtonProps } from './BUTCircleButton'

type BUTLeftRoundedCircleButtonProps = Omit<BUTCircleButtonProps, 'shape'>

const BUTLeftRoundedCircleButton: React.FC<BUTLeftRoundedCircleButtonProps> = (props) => {
  return <BUTCircleButton {...props} shape="left-rounded" />
}

export type { BUTLeftRoundedCircleButtonProps }
export default BUTLeftRoundedCircleButton
