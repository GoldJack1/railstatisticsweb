import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTIconLeftRoundedButton from '../../textInputButtons/icon/TXTINPBUTIconLeftRoundedButton'

export type TXTINPIconLeftRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTIconLeftRoundedButton>

const TXTINPIconLeftRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTIconLeftRoundedButton>, TXTINPIconLeftRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTIconLeftRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPIconLeftRoundedButton.displayName = 'TXTINPIconLeftRoundedButton'

export default TXTINPIconLeftRoundedButton
