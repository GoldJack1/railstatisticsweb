import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTIconLeftRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'label' | 'currencySymbol'>

const TXTINPBUTIconLeftRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTIconLeftRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="left-rounded" prefixType="icon" />,
)

TXTINPBUTIconLeftRoundedButton.displayName = 'TXTINPBUTIconLeftRoundedButton'

export default TXTINPBUTIconLeftRoundedButton
