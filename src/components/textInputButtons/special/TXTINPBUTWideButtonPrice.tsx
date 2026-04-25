import { forwardRef, useCallback } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTWideButtonPriceProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'label' | 'numeric'> & {
  /** Receives the parsed numeric value, or null when the field is empty / invalid. */
  onValueChange?: (value: number | null) => void
}

const parsePrice = (raw: string): number | null => {
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const TXTINPBUTWideButtonPrice = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTWideButtonPriceProps>(
  ({ onValueChange, onChange, currencySymbol = '£', ...props }, ref) => {
    const handleChange = useCallback((next: string) => {
      onChange?.(next)
      onValueChange?.(parsePrice(next))
    }, [onChange, onValueChange])

    return (
      <TXTINPBUTBaseButton
        ref={ref}
        {...props}
        shape="rounded"
        prefixType="currency"
        currencySymbol={currencySymbol}
        numeric
        onChange={handleChange}
      />
    )
  },
)

TXTINPBUTWideButtonPrice.displayName = 'TXTINPBUTWideButtonPrice'

export default TXTINPBUTWideButtonPrice
