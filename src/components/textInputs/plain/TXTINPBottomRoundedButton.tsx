import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTBottomRoundedButton from '../../textInputButtons/plain/TXTINPBUTBottomRoundedButton'

export type TXTINPBottomRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTBottomRoundedButton>

const TXTINPBottomRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTBottomRoundedButton>, TXTINPBottomRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTBottomRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPBottomRoundedButton.displayName = 'TXTINPBottomRoundedButton'

export default TXTINPBottomRoundedButton
