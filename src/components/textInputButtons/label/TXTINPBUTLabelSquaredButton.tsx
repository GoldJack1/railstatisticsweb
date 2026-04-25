import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLabelSquaredButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'currencySymbol'>

const TXTINPBUTLabelSquaredButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLabelSquaredButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="squared" prefixType="label" />,
)

TXTINPBUTLabelSquaredButton.displayName = 'TXTINPBUTLabelSquaredButton'

export default TXTINPBUTLabelSquaredButton
