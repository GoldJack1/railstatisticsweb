import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTIconRightRoundedButton from '../../textInputButtons/icon/TXTINPBUTIconRightRoundedButton'

export type TXTINPIconRightRoundedButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTIconRightRoundedButton>

const TXTINPIconRightRoundedButton = forwardRef<ElementRef<typeof TXTINPBUTIconRightRoundedButton>, TXTINPIconRightRoundedButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTIconRightRoundedButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPIconRightRoundedButton.displayName = 'TXTINPIconRightRoundedButton'

export default TXTINPIconRightRoundedButton
