import React, { type Ref } from 'react'
import Button from '../Button'
import type { CarouselHeroSlide, CarouselHeroSlideCta } from './heroCarouselSlideModel'

export type HeroSlideCopyNamespace = 'carousel' | 'static'

function heroClass(ns: HeroSlideCopyNamespace, part: string): string {
  const root = ns === 'carousel' ? 'rs-carousel-hero' : 'rs-static-hero'
  return `${root}__${part}`
}

export type HeroTitleHeadingLevel = 1 | 2 | 3

export const HeroSlideCtaRow: React.FC<{
  namespace: HeroSlideCopyNamespace
  ctas?: CarouselHeroSlideCta[]
}> = ({ namespace, ctas }) => {
  if (!ctas?.length) return null
  const multi = ctas.length > 1
  return (
    <div
      className={[
        heroClass(namespace, 'slide-ctas'),
        multi ? heroClass(namespace, 'slide-ctas--multi') : heroClass(namespace, 'slide-ctas--single')
      ].join(' ')}
    >
      <div className={heroClass(namespace, 'slide-ctas-inner')}>
        {ctas.map((cta, i) => (
          <div key={i} className={heroClass(namespace, 'slide-cta-wrap')}>
            <Button
              variant="wide"
              shape="rounded"
              width="fill"
              colorVariant={cta.colorVariant ?? 'accent'}
              href={cta.href}
              target={cta.target}
              onClick={cta.onClick}
              type="button"
            >
              {cta.label}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export const HeroSlideTextContent: React.FC<{
  namespace: HeroSlideCopyNamespace
  title: string
  body: React.ReactNode
  titleHeadingLevel?: HeroTitleHeadingLevel
  /** Optional ref on the title heading (e.g. carousel focus management). */
  titleRef?: Ref<HTMLHeadingElement>
}> = ({ namespace, title, body, titleHeadingLevel, titleRef }) => {
  const level = titleHeadingLevel ?? (namespace === 'carousel' ? 1 : 2)
  const TitleTag = (level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3') as 'h1' | 'h2' | 'h3'
  return (
    <>
      <div className={heroClass(namespace, 'title-wrap')}>
        <TitleTag ref={titleRef} className={heroClass(namespace, 'title')}>
          {title}
        </TitleTag>
      </div>
      <div className={heroClass(namespace, 'body')}>{body}</div>
    </>
  )
}

export const HeroSlideMeasureCopy: React.FC<{
  namespace: HeroSlideCopyNamespace
  slide: Pick<CarouselHeroSlide, 'title' | 'body'>
  titleHeadingLevel?: HeroTitleHeadingLevel
}> = ({ namespace, slide, titleHeadingLevel }) => (
  <div className={heroClass(namespace, 'text-measure-item')}>
    <HeroSlideTextContent
      namespace={namespace}
      title={slide.title}
      body={slide.body}
      titleHeadingLevel={titleHeadingLevel}
    />
  </div>
)
