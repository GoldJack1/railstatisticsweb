import type { MouseEvent, ReactNode } from 'react'
import type { HeroImageStackSources } from './HeroImageStack'

/** Per-slide art: dark/light × desktop-tablet / mobile (same shape as `HeroImageStack`). */
export type CarouselHeroSlideImageSources = HeroImageStackSources

export interface CarouselHeroSlideCta {
  label: string
  /** Renders as `<a>`. Omit to use `onClick` on a `<button>`. */
  href?: string
  target?: React.HTMLAttributeAnchorTarget
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
}

export interface CarouselHeroSlide {
  title: string
  body: ReactNode
  /** Optional row below body; one button uses hero width cap, two+ share desktop row rules in CSS. */
  ctas?: CarouselHeroSlideCta[]
  /**
   * `img` alt text when the art is informative. Leave empty for decorative art; the stack wrapper is then
   * `aria-hidden` so assistive tech skips it. Non-empty `imageAlt` removes the wrapper `aria-hidden` so the
   * images are exposed (same alt on light/dark sources).
   */
  imageAlt?: string
  /**
   * Per-slide art: light/dark × desktop-tablet / mobile URLs (`HeroImageStack`).
   * Omitted keys are filled from `defaultImageSources` on `CarouselHero` / `StaticHero`.
   */
  imageSources?: Partial<CarouselHeroSlideImageSources>
}

export function mergeCarouselHeroSlideSources(
  slide: CarouselHeroSlide,
  base: HeroImageStackSources
): HeroImageStackSources {
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

/** `hero` (default): hero band title/body sizes. `splash`: large splash copy on desktop only (≥1200px). */
export type HeroTextStyle = 'hero' | 'splash'
