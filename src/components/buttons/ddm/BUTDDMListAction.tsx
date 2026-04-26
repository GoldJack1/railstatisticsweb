import React from 'react'
import BUTDDMListBase, { type BUTDDMListBaseProps } from './BUTDDMListBase'

type BUTDDMListActionProps = Omit<BUTDDMListBaseProps, 'bottomType'>

const BUTDDMListAction: React.FC<BUTDDMListActionProps> = (props) => {
  return <BUTDDMListBase {...props} bottomType="clearAll40" />
}

export type { BUTDDMListActionProps }
export default BUTDDMListAction
