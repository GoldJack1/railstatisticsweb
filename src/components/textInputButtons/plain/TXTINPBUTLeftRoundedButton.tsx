import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLeftRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'label' | 'currencySymbol'>

const TXTINPBUTLeftRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLeftRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="left-rounded" prefixType="none" />,
)

TXTINPBUTLeftRoundedButton.displayName = 'TXTINPBUTLeftRoundedButton'

export default TXTINPBUTLeftRoundedButton
