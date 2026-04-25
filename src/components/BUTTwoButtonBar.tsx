import React from 'react'
import BUTBaseButtonBar, { type ButtonBarItem, type ButtonBarProps } from './BUTBaseButtonBar'

type BUTTwoButtonBarProps = Omit<ButtonBarProps, 'buttons'> & {
  buttons: [ButtonBarItem, ButtonBarItem]
}

const BUTTwoButtonBar: React.FC<BUTTwoButtonBarProps> = ({ buttons, ...rest }) => {
  return <BUTBaseButtonBar {...rest} buttons={buttons} />
}

export type { BUTTwoButtonBarProps }
export default BUTTwoButtonBar
