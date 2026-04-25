import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTIconTopRoundedButton from '../../textInputButtons/icon/TXTINPBUTIconTopRoundedButton'

export type TXTINPIconTopRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTIconTopRoundedButton>

const TXTINPIconTopRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTIconTopRoundedButton>, TXTINPIconTopRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTIconTopRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPIconTopRoundedButton.displayName = 'TXTINPIconTopRoundedButton'

export default TXTINPIconTopRoundedButton
