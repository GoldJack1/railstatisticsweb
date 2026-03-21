import React from 'react'
import Button from '../Button'
import './HomeHero.css'

export interface HomeHeroProps {
  title: string
  body: React.ReactNode
  primaryCtaLabel: string
  secondaryCtaLabel: string
  imageSrc: string
  imageAlt: string
  className?: string
}

const HomeHero: React.FC<HomeHeroProps> = ({
  title,
  body,
  primaryCtaLabel,
  secondaryCtaLabel,
  imageSrc,
  imageAlt,
  className = ''
}) => {
  return (
    <section className={['rs-home-hero', className].filter(Boolean).join(' ')}>
      <div className="rs-home-hero__inner-shadow" aria-hidden="true" />

      <div className="rs-home-hero__left">
        <h1 className="rs-home-hero__title">{title}</h1>

        <div className="rs-home-hero__body">
          {body}
        </div>

        <div className="rs-home-hero__cta-row">
          <Button variant="wide" shape="rounded" width="fill" disabled>
            {primaryCtaLabel}
          </Button>

          <div className="rs-home-hero__cta-spacer" aria-hidden="true" />

          <Button variant="wide" shape="rounded" width="fill" disabled>
            {secondaryCtaLabel}
          </Button>
        </div>
      </div>

      <div className="rs-home-hero__right">
        <img className="rs-home-hero__image" src={imageSrc} alt={imageAlt} />
      </div>
    </section>
  )
}

export default HomeHero

