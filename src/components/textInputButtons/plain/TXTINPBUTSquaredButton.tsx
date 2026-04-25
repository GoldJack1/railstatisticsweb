import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTSquaredButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'label' | 'currencySymbol'>

const TXTINPBUTSquaredButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTSquaredButtonProps>(
  (props, ref) => <TXTINPBUTBaseButton ref={ref} {...props} shape="squared" prefixType="none" />,
)

TXTINPBUTSquaredButton.displayName = 'TXTINPBUTSquaredButton'

export default TXTINPBUTSquaredButton
