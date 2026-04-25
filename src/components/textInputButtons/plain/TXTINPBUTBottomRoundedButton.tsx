import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTBottomRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'label' | 'currencySymbol'>

const TXTINPBUTBottomRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTBottomRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="bottom-rounded" prefixType="none" />,
)

TXTINPBUTBottomRoundedButton.displayName = 'TXTINPBUTBottomRoundedButton'

export default TXTINPBUTBottomRoundedButton
