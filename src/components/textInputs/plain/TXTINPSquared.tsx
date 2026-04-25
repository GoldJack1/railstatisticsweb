import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../../textInputButtons/base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPSquaredProps = Omit<
  TXTINPBUTBaseButtonProps,
  'shape' | 'prefixType' | 'icon' | 'label' | 'currencySymbol'
>

const TXTINPSquared = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPSquaredProps>(
  ({ className = '', ...props }, ref) => (
    <TXTINPBUTBaseButton
      ref={ref}
      {...props}
      shape="squared"
      prefixType="none"
      className={['rs-input--txtinp', className].filter(Boolean).join(' ')}
    />
  ),
)

TXTINPSquared.displayName = 'TXTINPSquared'

export default TXTINPSquared
