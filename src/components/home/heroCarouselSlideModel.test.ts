import { describe, expect, it } from 'vitest'
import { mergeCarouselHeroSlideSources, type CarouselHeroSlide } from './heroCarouselSlideModel'

const base = {
  darkDesktopTablet: '/d-dt.png',
  darkMobile: '/d-m.png',
  lightDesktopTablet: '/l-dt.png',
  lightMobile: '/l-m.png'
}

describe('mergeCarouselHeroSlideSources', () => {
  it('returns base when slide has no partial sources', () => {
    const slide: CarouselHeroSlide = { title: 'T', body: 'B' }
    expect(mergeCarouselHeroSlideSources(slide, base)).toEqual(base)
  })

  it('merges partial overrides', () => {
    const slide: CarouselHeroSlide = {
      title: 'T',
      body: 'B',
      imageSources: { lightMobile: '/only-light-mobile.png' }
    }
    expect(mergeCarouselHeroSlideSources(slide, base)).toEqual({
      ...base,
      lightMobile: '/only-light-mobile.png'
    })
  })
})
