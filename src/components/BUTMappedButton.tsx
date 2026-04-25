import React from 'react'
import type { ButtonProps } from './BUTBaseButton'
import BUTWideButton from './BUTWideButton'
import BUTTabButton from './BUTTabButton'
import BUTOperatorChip from './BUTOperatorChip'
import BUTLeftIconWideButton from './BUTLeftIconWideButton'
import BUTRightIconWideButton from './BUTRightIconWideButton'
import BUTCircleButton from './BUTCircleButton'
import BUTSquareButton from './BUTSquareButton'
import BUTLeftRoundedWideButton from './BUTLeftRoundedWideButton'
import BUTRightRoundedWideButton from './BUTRightRoundedWideButton'
import BUTTopRoundedWideButton from './BUTTopRoundedWideButton'
import BUTBottomRoundedWideButton from './BUTBottomRoundedWideButton'
import BUTSquaredWideButton from './BUTSquaredWideButton'

const BUTMappedButton: React.FC<ButtonProps> = (props) => {
  const { variant = 'wide', shape = 'rounded', iconPosition = 'left', ...rest } = props

  if (variant === 'tab') {
    return <BUTTabButton {...rest} />
  }

  if (variant === 'chip') {
    return <BUTOperatorChip {...rest} />
  }

  if (variant === 'circle') {
    return <BUTCircleButton {...rest} />
  }

  if (variant === 'square') {
    return <BUTSquareButton {...rest} />
  }

  // Wide variant family
  if (rest.icon) {
    if (iconPosition === 'right') {
      return <BUTRightIconWideButton {...rest} />
    }
    return <BUTLeftIconWideButton {...rest} />
  }

  if (shape === 'left-rounded') {
    return <BUTLeftRoundedWideButton {...rest} />
  }
  if (shape === 'right-rounded') {
    return <BUTRightRoundedWideButton {...rest} />
  }
  if (shape === 'top-rounded') {
    return <BUTTopRoundedWideButton {...rest} />
  }
  if (shape === 'bottom-rounded') {
    return <BUTBottomRoundedWideButton {...rest} />
  }
  if (shape === 'squared') {
    return <BUTSquaredWideButton {...rest} />
  }

  return <BUTWideButton {...rest} />
}

export default BUTMappedButton
