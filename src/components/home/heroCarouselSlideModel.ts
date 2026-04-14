import type { MouseEvent, ReactNode } from 'react'
import type { ButtonColorVariant } from '../Button'
import type { HeroImageStackSources } from './HeroImageStack'

/** Per-slide art: dark/light × desktop-tablet / mobile (same shape as `HeroImageStack`). */
export type CarouselHeroSlideImageSources = HeroImageStackSources
export type HeroMediaCropMode = 'cropped' | 'uncropped'

export interface CarouselHeroSlideCta {
  label: string
  /** Wide hero CTA colour; defaults to `accent`. */
  colorVariant?: ButtonColorVariant
  /** Renders as `<a>`. Omit to use `onClick` on a `<button>`. */
  href?: string
  target?: React.HTMLAttributeAnchorTarget
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
}

export interface CarouselHeroSlide {
  title: string
  body: ReactNode
  /** Optional autoplay duration override for this slide in milliseconds. */
  autoPlayMs?: number
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
  /**
   * Optional themed video art for this slide. When provided, `HeroImageStack` renders video
   * instead of images and plays only while the slide is active.
   */
  videoSources?: {
    dark: string
    light: string
    darkMobileTablet?: string
  }
  /** Mobile/tablet media framing for this slide only (defaults to hero-level setting). */
  mobileTabletMediaMode?: HeroMediaCropMode
  /** Optional max scale cap for mobile/tablet uncropped mode. */
  mobileTabletUncroppedMaxScale?: number
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

/** ≥1200px: which horizontal half holds the copy panel (LTR). Art stays full-bleed behind. */
export type HeroDesktopPanelSide = 'left' | 'right'

/** Viewports below 1200px: copy panel toward the top or bottom of the stacked hero band. */
export type HeroMobilePanelPosition = 'top' | 'bottom'

/**
 * Within the text panel: horizontal alignment for copy, CTAs, and (carousel) prev/next + indicators.
 * `start` = LTR left; `end` = LTR right.
 */
export type HeroPanelChromeAlign = 'start' | 'end'

/** `hero` (default): hero band title/body sizes. `splash`: large splash copy on desktop only (≥1200px). */
export type HeroTextStyle = 'hero' | 'splash'
