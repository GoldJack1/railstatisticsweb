import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLabelWideButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'currencySymbol'>

const TXTINPBUTLabelWideButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLabelWideButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="rounded" prefixType="label" />,
)

TXTINPBUTLabelWideButton.displayName = 'TXTINPBUTLabelWideButton'

export default TXTINPBUTLabelWideButton
