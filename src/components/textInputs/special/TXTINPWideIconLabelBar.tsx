import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTWideIconLabelBar from '../../textInputButtons/special/TXTINPBUTWideIconLabelBar'

export type TXTINPWideIconLabelBarProps = ComponentPropsWithoutRef<typeof TXTINPBUTWideIconLabelBar>

const TXTINPWideIconLabelBar = forwardRef<ElementRef<typeof TXTINPBUTWideIconLabelBar>, TXTINPWideIconLabelBarProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTWideIconLabelBar ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPWideIconLabelBar.displayName = 'TXTINPWideIconLabelBar'

export default TXTINPWideIconLabelBar
