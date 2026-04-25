import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTIconWideButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'label' | 'currencySymbol'>

const TXTINPBUTIconWideButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTIconWideButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="rounded" prefixType="icon" />,
)

TXTINPBUTIconWideButton.displayName = 'TXTINPBUTIconWideButton'

export default TXTINPBUTIconWideButton
