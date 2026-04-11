import type { MouseEvent, ReactNode } from 'react'
import type { HomeTopHeroImageStackSources } from './HomeTopHeroImageStack'

/** Same URLs as `HomeTopHeroImageStack`: dark/light × desktop-tablet / mobile. */
export type CarouselHeroSlideImageSources = HomeTopHeroImageStackSources

export interface CarouselHeroSlideCta {
  label: string
  /** Renders as `<a>` (same as HomeTopHero download). Omit to use `onClick` on a `<button>`. */
  href?: string
  target?: React.HTMLAttributeAnchorTarget
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
}

export interface CarouselHeroSlide {
  title: string
  body: ReactNode
  /** Optional row below body; one button uses TopHero width cap, two+ share desktop row rules in CSS. */
  ctas?: CarouselHeroSlideCta[]
  /** Meaningful description if the slide art conveys information (visual is `aria-hidden` today). */
  imageAlt?: string
  /**
   * Per-slide art: light/dark × desktop-tablet / mobile URLs (`HomeTopHeroImageStack`).
   * Omitted keys are filled from `defaultImageSources` on `CarouselHero` / `StaticHero`.
   */
  imageSources?: Partial<CarouselHeroSlideImageSources>
}

export function mergeCarouselHeroSlideSources(
  slide: CarouselHeroSlide,
  base: HomeTopHeroImageStackSources
): HomeTopHeroImageStackSources {
  const p = slide.imageSources
  if (!p) {
    return {
      darkDesktopTablet: base.darkDesktopTablet,
      darkMobile: base.darkMobile,
      lightDesktopTablet: base.lightDesktopTablet,
      lightMobile: base.lightMobile
    }
  }
  return {
    darkDesktopTablet: p.darkDesktopTablet ?? base.darkDesktopTablet,
    darkMobile: p.darkMobile ?? base.darkMobile,
    lightDesktopTablet: p.lightDesktopTablet ?? base.lightDesktopTablet,
    lightMobile: p.lightMobile ?? base.lightMobile
  }
}

/** Solid colour for text-panel gradient stops (before transparent fade). */
export type CarouselHeroContentFill = 'bgSecondary' | 'heroTint'
