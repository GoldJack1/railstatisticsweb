import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTTopRoundedButton from '../../textInputButtons/plain/TXTINPBUTTopRoundedButton'

export type TXTINPTopRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTTopRoundedButton>

const TXTINPTopRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTTopRoundedButton>, TXTINPTopRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTTopRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPTopRoundedButton.displayName = 'TXTINPTopRoundedButton'

export default TXTINPTopRoundedButton
