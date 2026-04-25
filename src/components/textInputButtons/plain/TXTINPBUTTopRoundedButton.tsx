import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTTopRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'label' | 'currencySymbol'>

const TXTINPBUTTopRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTTopRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="top-rounded" prefixType="none" />,
)

TXTINPBUTTopRoundedButton.displayName = 'TXTINPBUTTopRoundedButton'

export default TXTINPBUTTopRoundedButton
