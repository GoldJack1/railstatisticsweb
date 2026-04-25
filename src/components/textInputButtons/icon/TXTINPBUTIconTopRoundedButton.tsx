import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTIconTopRoundedButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'label' | 'currencySymbol'>

const TXTINPBUTIconTopRoundedButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTIconTopRoundedButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="top-rounded" prefixType="icon" />,
)

TXTINPBUTIconTopRoundedButton.displayName = 'TXTINPBUTIconTopRoundedButton'

export default TXTINPBUTIconTopRoundedButton
