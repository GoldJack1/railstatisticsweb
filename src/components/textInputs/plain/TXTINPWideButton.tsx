import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTWideButton from '../../textInputButtons/plain/TXTINPBUTWideButton'

export type TXTINPWideButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTWideButton>

const TXTINPWideButton = forwardRef<ElementRef<typeof TXTINPBUTWideButton>, TXTINPWideButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTWideButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPWideButton.displayName = 'TXTINPWideButton'

export default TXTINPWideButton
