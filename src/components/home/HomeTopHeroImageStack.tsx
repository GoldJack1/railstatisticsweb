import React from 'react'
import {
  TOP_HERO_IMAGE_DARK_DESKTOP_TABLET,
  TOP_HERO_IMAGE_DARK_MOBILE,
  TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET,
  TOP_HERO_IMAGE_LIGHT_MOBILE
} from './homeTopHeroImageConstants'
import './HomeTopHeroImageStack.css'

export type HomeTopHeroImageStackVariant = 'topHero' | 'homeHero'

/** Overrides default hometophero URLs (per-slide carousel art, tests, etc.). */
export interface HomeTopHeroImageStackSources {
  darkDesktopTablet: string
  darkMobile: string
  lightDesktopTablet: string
  lightMobile: string
}

export interface HomeTopHeroImageStackProps {
  variant: HomeTopHeroImageStackVariant
  /** `eager` for above-the-fold (TopHero); `lazy` ok for lower HomeHero. */
  loading?: 'eager' | 'lazy'
  /** When set, replaces built-in hometophero paths (HomeHero passes merged per-slide sources). */
  sources?: HomeTopHeroImageStackSources
  /** Optional `img` alt when art is meaningful; empty for decorative. */
  alt?: string
}

/** TopHero: desktop-tablet art from 640px. HomeHero: mobile art until 1024px (matches CSS layout). */
const DESKTOP_PICTURE_MEDIA: Record<HomeTopHeroImageStackVariant, string> = {
  topHero: '(min-width: 640px)',
  homeHero: '(min-width: 1024px)'
}

const HomeTopHeroImageStack: React.FC<HomeTopHeroImageStackProps> = ({
  variant,
  loading = 'eager',
  sources,
  alt = ''
}) => {
  const darkDesktopTablet = sources?.darkDesktopTablet ?? TOP_HERO_IMAGE_DARK_DESKTOP_TABLET
  const darkMobile = sources?.darkMobile ?? TOP_HERO_IMAGE_DARK_MOBILE
  const lightDesktopTablet = sources?.lightDesktopTablet ?? TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET
  const lightMobile = sources?.lightMobile ?? TOP_HERO_IMAGE_LIGHT_MOBILE

  return (
    <div
      className={[
        'rs-home-hero-image-stack',
        variant === 'topHero' ? 'rs-home-hero-image-stack--top-hero' : 'rs-home-hero-image-stack--home-hero'
      ].join(' ')}
      aria-hidden="true"
    >
      <div className="rs-home-hero-image-stack__frame">
        <picture className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--dark">
          <source media={DESKTOP_PICTURE_MEDIA[variant]} srcSet={darkDesktopTablet} />
          <img
            className="rs-home-hero-image-stack__image"
            src={darkMobile}
            alt={alt}
            loading={loading}
            decoding="async"
          />
        </picture>
        <picture className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--light">
          <source media={DESKTOP_PICTURE_MEDIA[variant]} srcSet={lightDesktopTablet} />
          <img
            className="rs-home-hero-image-stack__image"
            src={lightMobile}
            alt={alt}
            loading={loading}
            decoding="async"
          />
        </picture>
      </div>
      {variant === 'topHero' ? <div className="rs-home-hero-image-stack__gradient" /> : null}
    </div>
  )
}

export default HomeTopHeroImageStack
