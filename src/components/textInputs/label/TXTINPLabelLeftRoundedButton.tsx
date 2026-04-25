import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLabelLeftRoundedButton from '../../textInputButtons/label/TXTINPBUTLabelLeftRoundedButton'

export type TXTINPLabelLeftRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTLabelLeftRoundedButton>

const TXTINPLabelLeftRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTLabelLeftRoundedButton>, TXTINPLabelLeftRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLabelLeftRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLabelLeftRoundedButton.displayName = 'TXTINPLabelLeftRoundedButton'

export default TXTINPLabelLeftRoundedButton
