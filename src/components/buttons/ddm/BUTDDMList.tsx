import React from 'react'
import BUTDDMListBase, { type BUTDDMListBaseProps } from './BUTDDMListBase'

type BUTDDMListProps = Omit<BUTDDMListBaseProps, 'bottomType'>

const BUTDDMList: React.FC<BUTDDMListProps> = (props) => {
  return <BUTDDMListBase {...props} bottomType="spacer20" />
}

export type { BUTDDMListProps }
export default BUTDDMList
