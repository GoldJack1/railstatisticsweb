import React from 'react'
import BUTBaseButtonBar, { type ButtonBarProps } from './BUTBaseButtonBar'
import BUTTwoButtonBar from './BUTTwoButtonBar'
import BUTThreeButtonBar from './BUTThreeButtonBar'

const BUTMappedButtonBar: React.FC<ButtonBarProps> = ({ buttons, ...rest }) => {
  if (buttons.length === 2) {
    return <BUTTwoButtonBar {...rest} buttons={[buttons[0], buttons[1]]} />
  }
  if (buttons.length === 3) {
    return <BUTThreeButtonBar {...rest} buttons={[buttons[0], buttons[1], buttons[2]]} />
  }

  return <BUTBaseButtonBar {...rest} buttons={buttons} />
}

export default BUTMappedButtonBar
