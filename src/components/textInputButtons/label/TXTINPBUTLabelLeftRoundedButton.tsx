import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLabelLeftRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'currencySymbol'>

const TXTINPBUTLabelLeftRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLabelLeftRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="left-rounded" prefixType="label" />,
)

TXTINPBUTLabelLeftRoundedButton.displayName = 'TXTINPBUTLabelLeftRoundedButton'

export default TXTINPBUTLabelLeftRoundedButton
