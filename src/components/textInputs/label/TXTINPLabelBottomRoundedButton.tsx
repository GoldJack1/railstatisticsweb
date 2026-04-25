import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLabelBottomRoundedButton from '../../textInputButtons/label/TXTINPBUTLabelBottomRoundedButton'

export type TXTINPLabelBottomRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTLabelBottomRoundedButton>

const TXTINPLabelBottomRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTLabelBottomRoundedButton>, TXTINPLabelBottomRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLabelBottomRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLabelBottomRoundedButton.displayName = 'TXTINPLabelBottomRoundedButton'

export default TXTINPLabelBottomRoundedButton
