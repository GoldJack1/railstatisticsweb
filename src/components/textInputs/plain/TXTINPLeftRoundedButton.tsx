import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLeftRoundedButton from '../../textInputButtons/plain/TXTINPBUTLeftRoundedButton'

export type TXTINPLeftRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTLeftRoundedButton>

const TXTINPLeftRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTLeftRoundedButton>, TXTINPLeftRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLeftRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLeftRoundedButton.displayName = 'TXTINPLeftRoundedButton'

export default TXTINPLeftRoundedButton
