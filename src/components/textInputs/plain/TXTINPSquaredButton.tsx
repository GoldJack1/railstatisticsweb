import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTSquaredButton from '../../textInputButtons/plain/TXTINPBUTSquaredButton'

export type TXTINPSquaredButtonProps = ComponentPropsWithoutRef<typeof TXTINPBUTSquaredButton>

const TXTINPSquaredButton = forwardRef<ElementRef<typeof TXTINPBUTSquaredButton>, TXTINPSquaredButtonProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTSquaredButton ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPSquaredButton.displayName = 'TXTINPSquaredButton'

export default TXTINPSquaredButton
