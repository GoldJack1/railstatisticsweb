import React from 'react'
import Button from '../Button'
import './HomeTopHero.css'

const DEFAULT_CTA_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'
const DEFAULT_IMAGE_URL_DARK = '/images/home/newherotopdark.png'
const DEFAULT_IMAGE_URL_LIGHT = '/images/home/newherotoplight.png'

export interface HomeTopHeroProps {
  title?: string
  subtitle?: string
  ctaLabel?: string
  ctaHref?: string
  className?: string
}

const HomeTopHero: React.FC<HomeTopHeroProps> = ({
  title = 'The Ultimate Station Bashing App is Here!',
  subtitle = "Start building a map of where you've been, one station at a time.",
  ctaLabel = 'Download Now',
  ctaHref = DEFAULT_CTA_URL,
  className = ''
}) => {
  return (
    <section className={['rs-home-top-hero', className].filter(Boolean).join(' ')}>
      <div className="rs-home-top-hero__frame12">
        <div className="rs-home-top-hero__text-and-button">
          <div className="rs-home-top-hero__frame15">
            <h1 className="rs-home-top-hero__title">{title}</h1>
          </div>
          <div className="rs-home-top-hero__frame16">
            <p className="rs-home-top-hero__subtitle">{subtitle}</p>
          </div>
          <div className="rs-home-top-hero__frame14">
            <div className="rs-home-top-hero__cta-wrap">
              <Button
                variant="wide"
                shape="rounded"
                width="fill"
                colorVariant="accent"
                href={ctaHref}
                className="rs-home-top-hero__cta"
              >
                {ctaLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="rs-home-top-hero__frame4" aria-hidden="true">
          {/* Dark mode image */}
          <picture className="rs-home-top-hero__picture rs-home-top-hero__picture--dark">
            <img className="rs-home-top-hero__image" src={DEFAULT_IMAGE_URL_DARK} alt="" loading="eager" decoding="async" />
          </picture>
          {/* Light mode image */}
          <picture className="rs-home-top-hero__picture rs-home-top-hero__picture--light">
            <img className="rs-home-top-hero__image" src={DEFAULT_IMAGE_URL_LIGHT} alt="" loading="eager" decoding="async" />
          </picture>
        </div>

        <div className="rs-home-top-hero__gradient-layer" aria-hidden="true" />
      </div>
    </section>
  )
}

export default HomeTopHero
