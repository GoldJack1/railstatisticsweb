import React from 'react'
import Button from '../Button'
import { getOptimalImageLoading } from '../../utils/performance'
import './HomeHero.css'

const DEFAULT_IOS_APP_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'
const DEFAULT_ANDROID_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.jw.railstatisticsandroid.beta&pli=1'

/** Figma NEWHERO raster exports (desktop / tablet / mobile artboards). */
const DEFAULT_IMAGE_SOURCES = {
  desktop: '/images/home/hero-newhero-desktop.png',
  tablet: '/images/home/hero-newhero-tablet.png',
  mobile: '/images/home/hero-newhero-mobile.png'
} as const

export interface HomeHeroProps {
  title: string
  body: React.ReactNode
  primaryCtaLabel: string
  secondaryCtaLabel: string
  /** Defaults to the Rail Statistics iOS App Store listing. */
  primaryCtaHref?: string
  /** Defaults to the Rail Statistics Google Play listing. */
  secondaryCtaHref?: string
  imageAlt: string
  imageSources?: {
    desktop: string
    tablet: string
    mobile: string
  }
  className?: string
}

const HomeHero: React.FC<HomeHeroProps> = ({
  title,
  body,
  primaryCtaLabel,
  secondaryCtaLabel,
  primaryCtaHref = DEFAULT_IOS_APP_URL,
  secondaryCtaHref = DEFAULT_ANDROID_PLAY_URL,
  imageAlt,
  imageSources = DEFAULT_IMAGE_SOURCES,
  className = ''
}) => {
  const { desktop, tablet, mobile } = imageSources

  return (
    <section className={['rs-home-hero', className].filter(Boolean).join(' ')}>
      <div className="rs-home-hero__inner-shadow" aria-hidden="true" />

      <div className="rs-home-hero__content">
        <div className="rs-home-hero__text-block">
          <div className="rs-home-hero__title-wrap">
            <h1 className="rs-home-hero__title">{title}</h1>
          </div>
          <div className="rs-home-hero__body">{body}</div>
        </div>

        <div className="rs-home-hero__cta-row">
          <Button variant="wide" shape="rounded" width="fill" href={primaryCtaHref}>
            {primaryCtaLabel}
          </Button>
          <Button variant="wide" shape="rounded" width="fill" href={secondaryCtaHref}>
            {secondaryCtaLabel}
          </Button>
        </div>
      </div>

      <div className="rs-home-hero__visual">
        <picture>
          <source media="(min-width: 1024px)" srcSet={desktop} />
          <source media="(min-width: 640px)" srcSet={tablet} />
          <img
            className="rs-home-hero__image"
            src={mobile}
            alt={imageAlt}
            loading={getOptimalImageLoading()}
            decoding="async"
            width={800}
            height={600}
          />
        </picture>
      </div>
    </section>
  )
}

export default HomeHero
