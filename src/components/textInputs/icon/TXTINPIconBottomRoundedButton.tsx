import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTIconBottomRoundedButton from '../../textInputButtons/icon/TXTINPBUTIconBottomRoundedButton'

export type TXTINPIconBottomRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTIconBottomRoundedButton>

const TXTINPIconBottomRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTIconBottomRoundedButton>, TXTINPIconBottomRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTIconBottomRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPIconBottomRoundedButton.displayName = 'TXTINPIconBottomRoundedButton'

export default TXTINPIconBottomRoundedButton
