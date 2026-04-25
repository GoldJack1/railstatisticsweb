import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLabelRightRoundedButton from '../../textInputButtons/label/TXTINPBUTLabelRightRoundedButton'

export type TXTINPLabelRightRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTLabelRightRoundedButton>

const TXTINPLabelRightRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTLabelRightRoundedButton>, TXTINPLabelRightRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLabelRightRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLabelRightRoundedButton.displayName = 'TXTINPLabelRightRoundedButton'

export default TXTINPLabelRightRoundedButton
