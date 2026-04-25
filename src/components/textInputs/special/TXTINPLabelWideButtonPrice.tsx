import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTLabelWideButtonPrice from '../../textInputButtons/special/TXTINPBUTLabelWideButtonPrice'

export type TXTINPLabelWideButtonPriceProps = ComponentPropsWithoutRef<typeof TXTINPBUTLabelWideButtonPrice>

const TXTINPLabelWideButtonPrice = forwardRef<ElementRef<typeof TXTINPBUTLabelWideButtonPrice>, TXTINPLabelWideButtonPriceProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTLabelWideButtonPrice ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPLabelWideButtonPrice.displayName = 'TXTINPLabelWideButtonPrice'

export default TXTINPLabelWideButtonPrice
