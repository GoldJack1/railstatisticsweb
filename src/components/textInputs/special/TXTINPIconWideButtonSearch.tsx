import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import TXTINPBUTIconWideButtonSearch from '../../textInputButtons/special/TXTINPBUTIconWideButtonSearch'

export type TXTINPIconWideButtonSearchProps = ComponentPropsWithoutRef<typeof TXTINPBUTIconWideButtonSearch>

const TXTINPIconWideButtonSearch = forwardRef<ElementRef<typeof TXTINPBUTIconWideButtonSearch>, TXTINPIconWideButtonSearchProps>(({ className = '', ...props }, ref) => (
  <TXTINPBUTIconWideButtonSearch ref={ref} {...props} className={['rs-input--txtinp', className].filter(Boolean).join(' ')} />
))

TXTINPIconWideButtonSearch.displayName = 'TXTINPIconWideButtonSearch'

export default TXTINPIconWideButtonSearch
