import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLabelSquaredButton from '../../textInputButtons/label/TXTINPBUTLabelSquaredButton'

export type TXTINPLabelSquaredButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTLabelSquaredButton>

const TXTINPLabelSquaredButton = forwardRef<ElementRef<typeof TXTINPBUTLabelSquaredButton>, TXTINPLabelSquaredButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLabelSquaredButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLabelSquaredButton.displayName = 'TXTINPLabelSquaredButton'

export default TXTINPLabelSquaredButton
