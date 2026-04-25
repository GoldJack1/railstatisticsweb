import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTIconSquaredButton from '../../textInputButtons/icon/TXTINPBUTIconSquaredButton'

export type TXTINPIconSquaredButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTIconSquaredButton>

const TXTINPIconSquaredButton = forwardRef<ElementRef<typeof TXTINPBUTIconSquaredButton>, TXTINPIconSquaredButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTIconSquaredButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPIconSquaredButton.displayName = 'TXTINPIconSquaredButton'

export default TXTINPIconSquaredButton
