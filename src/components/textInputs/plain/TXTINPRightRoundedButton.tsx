import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTRightRoundedButton from '../../textInputButtons/plain/TXTINPBUTRightRoundedButton'

export type TXTINPRightRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTRightRoundedButton>

const TXTINPRightRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTRightRoundedButton>, TXTINPRightRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTRightRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPRightRoundedButton.displayName = 'TXTINPRightRoundedButton'

export default TXTINPRightRoundedButton
