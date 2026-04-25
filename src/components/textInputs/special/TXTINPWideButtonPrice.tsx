import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTWideButtonPrice from '../../textInputButtons/special/TXTINPBUTWideButtonPrice'

export type TXTINPWideButtonPriceProps = ComponentPropsWithoutRef<typeof TXTINPBUTWideButtonPrice>

const TXTINPWideButtonPrice = forwardRef<ElementRef<typeof TXTINPBUTWideButtonPrice>, TXTINPWideButtonPriceProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTWideButtonPrice ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPWideButtonPrice.displayName = 'TXTINPWideButtonPrice'

export default TXTINPWideButtonPrice
