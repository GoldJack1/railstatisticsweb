import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLabelTopRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'currencySymbol'>

const TXTINPBUTLabelTopRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLabelTopRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="top-rounded" prefixType="label" />,
)

TXTINPBUTLabelTopRoundedButton.displayName = 'TXTINPBUTLabelTopRoundedButton'

export default TXTINPBUTLabelTopRoundedButton
