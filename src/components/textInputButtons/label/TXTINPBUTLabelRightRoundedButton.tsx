import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLabelRightRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'currencySymbol'>

const TXTINPBUTLabelRightRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLabelRightRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="right-rounded" prefixType="label" />,
)

TXTINPBUTLabelRightRoundedButton.displayName = 'TXTINPBUTLabelRightRoundedButton'

export default TXTINPBUTLabelRightRoundedButton
