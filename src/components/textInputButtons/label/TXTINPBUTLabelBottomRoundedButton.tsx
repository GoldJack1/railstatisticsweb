import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLabelBottomRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'currencySymbol'>

const TXTINPBUTLabelBottomRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLabelBottomRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="bottom-rounded" prefixType="label" />,
)

TXTINPBUTLabelBottomRoundedButton.displayName = 'TXTINPBUTLabelBottomRoundedButton'

export default TXTINPBUTLabelBottomRoundedButton
