import React, { useRef } from 'react'
import { useScrollDirectionFade, type ScrollDirectionFadeOptions } from '../hooks/useScrollDirectionFade'
import './ScrollFadeReveal.css'

/** Class string for elements that share scroll-direction fade (not necessarily wrapped in `ScrollFadeReveal`). */
export function scrollFadeRevealClassNames(visible: boolean): string {
  return visible ? 'rs-scroll-fade-reveal rs-scroll-fade-reveal--visible' : 'rs-scroll-fade-reveal'
}

export type ScrollFadeRevealProps = {
  children: React.ReactNode
  className?: string
} & ScrollDirectionFadeOptions

/**
 * Wraps a block so it fades in as it enters the viewport while scrolling. No scroll-up fade-out.
 * Respects `prefers-reduced-motion` (content stays fully visible).
 */
const ScrollFadeReveal: React.FC<ScrollFadeRevealProps> = ({
  children,
  className = '',
  revealLine
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const visible = useScrollDirectionFade(rootRef, { revealLine })

  return (
    <div ref={rootRef} className={[scrollFadeRevealClassNames(visible), className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

export default ScrollFadeReveal
