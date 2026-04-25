import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTIconBottomRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'label' | 'currencySymbol'>

const TXTINPBUTIconBottomRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTIconBottomRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="bottom-rounded" prefixType="icon" />,
)

TXTINPBUTIconBottomRoundedButton.displayName = 'TXTINPBUTIconBottomRoundedButton'

export default TXTINPBUTIconBottomRoundedButton
