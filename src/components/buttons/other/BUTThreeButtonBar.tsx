import React from 'react'
import BUTBaseButtonBar, { type ButtonBarItem, type ButtonBarProps } from '../base/BUTBaseButtonBar/BUTBaseButtonBar'

type BUTThreeButtonBarProps = Omit<ButtonBarProps, 'buttons'> & {
  buttons: [ButtonBarItem, ButtonBarItem, ButtonBarItem]
}

const BUTThreeButtonBar: React.FC<BUTThreeButtonBarProps> = ({ buttons, ...rest }) => {
  return <BUTBaseButtonBar {...rest} buttons={buttons} />
}

export type { BUTThreeButtonBarProps }
export default BUTThreeButtonBar
