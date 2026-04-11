import type { CSSProperties } from 'react'

/**
 * Copy/CTA Y-fade timings — single source for JS timeouts and inline CSS variables on the hero section.
 * CarouselHero / StaticHero inject `--{carousel|static}-hero-slide-*` from these values.
 * (Tighter exit + gap keeps incoming copy closer on the heels of the outgoing animation.)
 */
export const HERO_COPY_SLIDE_EXIT_MS = 280
export const HERO_COPY_SLIDE_ENTER_GAP_MS = 8
export const HERO_COPY_SLIDE_ENTER_MS = 450
/** Buffer after enter animation before clearing outgoing DOM (CarouselHero swap timeout). */
export const HERO_SLIDE_SWAP_CLEAR_BUFFER_MS = 50

export function getHeroSlideSwapClearTimeoutMs(): number {
  return (
    HERO_COPY_SLIDE_EXIT_MS + HERO_COPY_SLIDE_ENTER_GAP_MS + HERO_COPY_SLIDE_ENTER_MS + HERO_SLIDE_SWAP_CLEAR_BUFFER_MS
  )
}

export type HeroCopySlideCssVarKind = 'carousel' | 'static'

/** Set on the hero `<section>` so keyframes match `getHeroSlideSwapClearTimeoutMs()`. */
export function heroCopySlideCssVarProperties(kind: HeroCopySlideCssVarKind): CSSProperties {
  const p = kind === 'carousel' ? '--carousel-hero-slide' : '--static-hero-slide'
  return {
    [`${p}-exit-duration`]: `${HERO_COPY_SLIDE_EXIT_MS}ms`,
    [`${p}-enter-gap`]: `${HERO_COPY_SLIDE_ENTER_GAP_MS}ms`,
    [`${p}-enter-duration`]: `${HERO_COPY_SLIDE_ENTER_MS}ms`,
    [`${p}-enter-delay`]: `calc(${HERO_COPY_SLIDE_EXIT_MS}ms + ${HERO_COPY_SLIDE_ENTER_GAP_MS}ms)`
  } as CSSProperties
}
