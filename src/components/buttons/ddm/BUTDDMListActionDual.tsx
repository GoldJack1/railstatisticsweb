import React from 'react'
import BUTDDMListBase, { type BUTDDMListBaseProps } from './BUTDDMListBase'

type BUTDDMListActionDualProps = Omit<BUTDDMListBaseProps, 'bottomType'>

const BUTDDMListActionDual: React.FC<BUTDDMListActionDualProps> = (props) => {
  return <BUTDDMListBase {...props} bottomType="clearAllSelectAll40" />
}

export type { BUTDDMListActionDualProps }
export default BUTDDMListActionDual
