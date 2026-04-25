import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import TXTINPBUTBaseButton, {
  type TXTINPBUTBaseButtonHandle,
  type TXTINPBUTBaseButtonProps,
} from '../base/TXTINPBUTBaseButton/TXTINPBUTBaseButton'

export type TXTINPBUTWideIconLabelBarProps = Omit<TXTINPBUTBaseButtonProps, 'shape' | 'prefixType' | 'currencySymbol'> & {
  /** Label prefix shown while the bar is in active mode (e.g. "Name:", "CRS:", "TIPLOC:"). */
  labelPrefix: string
  /** Force uppercase input regardless of the user's typing case. */
  forceUppercase?: boolean
  /** Optional initial mode override. Defaults to "icon" until the input is focused or has content. */
  initialMode?: 'icon' | 'label'
}

const TXTINPBUTWideIconLabelBar = forwardRef<TXTINPBUTBaseButtonHandle, TXTINPBUTWideIconLabelBarProps>(
  ({
    icon,
    labelPrefix,
    forceUppercase = false,
    initialMode = 'icon',
    value,
    defaultValue,
    onFocus,
    onBlur,
    onChange,
    onClear,
    uppercase,
    ...props
  }, ref) => {
    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = useState<string>(defaultValue ?? '')
    const currentValue = isControlled ? (value ?? '') : internalValue

    const [isFocused, setIsFocused] = useState(initialMode === 'label')
    const innerRef = useRef<TXTINPBUTBaseButtonHandle>(null)

    useImperativeHandle(ref, () => ({
      focus: () => innerRef.current?.focus(),
      blur: () => innerRef.current?.blur(),
      clear: () => {
        if (!isControlled) setInternalValue('')
        innerRef.current?.clear()
      },
      getValue: () => currentValue,
    }), [isControlled, currentValue])

    const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.(event)
    }, [onFocus])

    const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.(event)
    }, [onBlur])

    const handleChange = useCallback((next: string) => {
      if (!isControlled) setInternalValue(next)
      onChange?.(next)
    }, [isControlled, onChange])

    const handleClear = useCallback(() => {
      if (!isControlled) setInternalValue('')
      onClear?.()
    }, [isControlled, onClear])

    const showLabelPrefix = isFocused || currentValue.length > 0
    const prefixType = showLabelPrefix ? 'label' : 'icon'

    return (
      <TXTINPBUTBaseButton
        ref={innerRef}
        {...props}
        shape="rounded"
        prefixType={prefixType}
        icon={icon}
        label={labelPrefix}
        value={currentValue}
        uppercase={uppercase ?? forceUppercase}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onClear={handleClear}
      />
    )
  },
)

TXTINPBUTWideIconLabelBar.displayName = 'TXTINPBUTWideIconLabelBar'

export default TXTINPBUTWideIconLabelBar
