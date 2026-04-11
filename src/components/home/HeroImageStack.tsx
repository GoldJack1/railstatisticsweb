import React from 'react'
import {
  HERO_IMAGE_DARK_DESKTOP_TABLET,
  HERO_IMAGE_DARK_MOBILE,
  HERO_IMAGE_LIGHT_DESKTOP_TABLET,
  HERO_IMAGE_LIGHT_MOBILE
} from './heroImageConstants'
import './HeroImageStack.css'

export type HeroImageStackVariant = 'carousel' | 'static'

/** Overrides default hero art URLs (per-slide carousel art, tests, etc.). */
export interface HeroImageStackSources {
  darkDesktopTablet: string
  darkMobile: string
  lightDesktopTablet: string
  lightMobile: string
}

export interface HeroImageStackProps {
  variant: HeroImageStackVariant
  /** `eager` for above-the-fold primary hero; `lazy` for lower sections. */
  loading?: 'eager' | 'lazy'
  /** When set, replaces built-in paths (e.g. merged per-slide sources). */
  sources?: HeroImageStackSources
  /** Optional `img` alt when art is meaningful; empty for decorative. */
  alt?: string
}

const DESKTOP_PICTURE_MEDIA = '(min-width: 1200px)'

const VARIANT_MODIFIER: Record<HeroImageStackVariant, string> = {
  carousel: 'rs-home-hero-image-stack--carousel-hero',
  static: 'rs-home-hero-image-stack--static-hero'
}

const HeroImageStack: React.FC<HeroImageStackProps> = ({
  variant,
  loading = 'eager',
  sources,
  alt = ''
}) => {
  const darkDesktopTablet = sources?.darkDesktopTablet ?? HERO_IMAGE_DARK_DESKTOP_TABLET
  const darkMobile = sources?.darkMobile ?? HERO_IMAGE_DARK_MOBILE
  const lightDesktopTablet = sources?.lightDesktopTablet ?? HERO_IMAGE_LIGHT_DESKTOP_TABLET
  const lightMobile = sources?.lightMobile ?? HERO_IMAGE_LIGHT_MOBILE
  const decorative = alt.trim() === ''

  return (
    <div
      className={['rs-home-hero-image-stack', VARIANT_MODIFIER[variant]].join(' ')}
      aria-hidden={decorative ? true : undefined}
    >
      <div className="rs-home-hero-image-stack__frame">
        <picture className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--dark">
          <source media={DESKTOP_PICTURE_MEDIA} srcSet={darkDesktopTablet} />
          <img
            className="rs-home-hero-image-stack__image"
            src={darkMobile}
            alt={alt}
            loading={loading}
            decoding="async"
          />
        </picture>
        <picture className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--light">
          <source media={DESKTOP_PICTURE_MEDIA} srcSet={lightDesktopTablet} />
          <img
            className="rs-home-hero-image-stack__image"
            src={lightMobile}
            alt={alt}
            loading={loading}
            decoding="async"
          />
        </picture>
      </div>
    </div>
  )
}

export default HeroImageStack
