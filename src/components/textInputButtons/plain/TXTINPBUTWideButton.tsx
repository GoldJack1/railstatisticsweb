import { forwardRef } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTWideButtonProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'label' | 'currencySymbol'> & {
  /** Convenience for the Android offer-code mode: forces uppercase + strips spaces. */
  offerCodeMode?: boolean
}

const TXTINPBUTWideButton = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTWideButtonProps>(
  ({ offerCodeMode = false, uppercase, stripSpaces, ...props }, ref) => (
    <TXTINPBUTBaseButton
      ref={ref}
      {...props}
      shape="rounded"
      prefixType="none"
      uppercase={uppercase ?? offerCodeMode}
      stripSpaces={stripSpaces ?? offerCodeMode}
    />
  ),
)

TXTINPBUTWideButton.displayName = 'TXTINPBUTWideButton'

export default TXTINPBUTWideButton
