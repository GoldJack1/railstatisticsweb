import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTIconRightRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'label' | 'currencySymbol'>

const TXTINPBUTIconRightRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTIconRightRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="right-rounded" prefixType="icon" />,
)

TXTINPBUTIconRightRoundedButton.displayName = 'TXTINPBUTIconRightRoundedButton'

export default TXTINPBUTIconRightRoundedButton
