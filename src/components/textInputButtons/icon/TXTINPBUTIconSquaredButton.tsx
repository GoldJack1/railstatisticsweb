import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTIconSquaredButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'label' | 'currencySymbol'>

const TXTINPBUTIconSquaredButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTIconSquaredButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="squared" prefixType="icon" />,
)

TXTINPBUTIconSquaredButton.displayName = 'TXTINPBUTIconSquaredButton'

export default TXTINPBUTIconSquaredButton
