import React from 'react'
import BUTBaseButton, { type ButtonProps } from './BUTBaseButton'

type BUTTextNumberSquareButtonProps = Omit<ButtonProps, 'variant' | 'shape' | 'icon' | 'children'> & {
  text: string
}

const sanitizeTextNumber = (input: string): string => {
  let mode: 'letters' | 'numbers' | null = null
  let count = 0
  let output = ''

  for (const char of input) {
    const isLetter = /[a-zA-Z]/.test(char)
    const isNumber = /[0-9]/.test(char)
    if (!isLetter && !isNumber) continue

    if (!mode) {
      mode = isLetter ? 'letters' : 'numbers'
    }

    if (mode === 'letters') {
      if (!isLetter || count >= 2) continue
      output += char.toUpperCase()
      count += 1
      continue
    }

    if (!isNumber || count >= 2) continue
    output += char
    count += 1
  }

  return output
}

const BUTTextNumberSquareButton: React.FC<BUTTextNumberSquareButtonProps> = ({
  text,
  ariaLabel,
  ...props
}) => {
  const safeText = sanitizeTextNumber(text)

  return (
    <BUTBaseButton
      {...props}
      variant="square"
      shape="squared"
      width="hug"
      ariaLabel={ariaLabel ?? `Text number square button ${safeText || 'empty'}`}
    >
      {safeText}
    </BUTBaseButton>
  )
}

export type { BUTTextNumberSquareButtonProps }
export default BUTTextNumberSquareButton
