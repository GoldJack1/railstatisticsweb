import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLabelWideButton from '../../textInputButtons/label/TXTINPBUTLabelWideButton'

export type TXTINPLabelWideButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTLabelWideButton>

const TXTINPLabelWideButton = forwardRef<ElementRef<typeof TXTINPBUTLabelWideButton>, TXTINPLabelWideButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLabelWideButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLabelWideButton.displayName = 'TXTINPLabelWideButton'

export default TXTINPLabelWideButton
