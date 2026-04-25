import { forwardRef, useCallback } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTLabelWideButtonPriceProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'icon' | 'numeric'> & {
  label: string
  /** Receives the parsed numeric value, or null when the field is empty / invalid. */
  onValueChange?: (value: number | null) => void
}

const parsePrice = (raw: string): number | null => {
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const TXTINPBUTLabelWideButtonPrice = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTLabelWideButtonPriceProps>(
  ({ label, currencySymbol = '£', onValueChange, onChange, ...props }, ref) => {
    const handleChange = useCallback((next: string) => {
      onChange?.(next)
      onValueChange?.(parsePrice(next))
    }, [onChange, onValueChange])

    return (
      <TXTINPBUTBaseButton
        ref={ref}
        {...props}
        shape="rounded"
        prefixType="label"
        label={`${label} ${currencySymbol}`}
        numeric
        onChange={handleChange}
      />
    )
  },
)

TXTINPBUTLabelWideButtonPrice.displayName = 'TXTINPBUTLabelWideButtonPrice'

export default TXTINPBUTLabelWideButtonPrice
