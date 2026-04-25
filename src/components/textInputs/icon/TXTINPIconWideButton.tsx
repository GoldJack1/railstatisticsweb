import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTIconWideButton from '../../textInputButtons/icon/TXTINPBUTIconWideButton'

export type TXTINPIconWideButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTIconWideButton>

const TXTINPIconWideButton = forwardRef<ElementRef<typeof TXTINPBUTIconWideButton>, TXTINPIconWideButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTIconWideButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPIconWideButton.displayName = 'TXTINPIconWideButton'

export default TXTINPIconWideButton
