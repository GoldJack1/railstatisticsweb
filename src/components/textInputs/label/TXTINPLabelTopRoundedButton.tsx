import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLabelTopRoundedButton from '../../textInputButtons/label/TXTINPBUTLabelTopRoundedButton'

export type TXTINPLabelTopRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTLabelTopRoundedButton>

const TXTINPLabelTopRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTLabelTopRoundedButton>, TXTINPLabelTopRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLabelTopRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLabelTopRoundedButton.displayName = 'TXTINPLabelTopRoundedButton'

export default TXTINPLabelTopRoundedButton
