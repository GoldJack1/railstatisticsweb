import React from 'react'
import BUTBaseVisitStatusButton, { type BUTBaseVisitStatusButtonProps } from './BUTBaseVisitStatusButton'

const BUTVisitStatusButton: React.FC<BUTBaseVisitStatusButtonProps> = (props) => {
  return <BUTBaseVisitStatusButton {...props} />
}

export type { BUTBaseVisitStatusButtonProps as BUTVisitStatusButtonProps }
export default BUTVisitStatusButton
