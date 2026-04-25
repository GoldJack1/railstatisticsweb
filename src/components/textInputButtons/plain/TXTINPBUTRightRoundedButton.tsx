import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTRightRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'label' | 'currencySymbol'>

const TXTINPBUTRightRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTRightRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="right-rounded" prefixType="none" />,
)

TXTINPBUTRightRoundedButton.displayName = 'TXTINPBUTRightRoundedButton'

export default TXTINPBUTRightRoundedButton
