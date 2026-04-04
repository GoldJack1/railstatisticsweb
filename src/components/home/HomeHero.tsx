import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Button from '../Button'
import { getOptimalImageLoading } from '../../utils/performance'
import './HomeHero.css'

const DEFAULT_IOS_APP_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'
const DEFAULT_ANDROID_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.jw.railstatisticsandroid.beta&pli=1'

const DEFAULT_IMAGE_SOURCES = {
  desktop: '/images/home/hero-newhero-desktop.png',
  tablet: '/images/home/hero-newhero-tablet.png',
  mobile: '/images/home/hero-newhero-mobile.png'
} as const

const AUTO_PLAY_MS_DEFAULT = 10_000
/** Minimum horizontal travel (px) to count as a swipe. */
const SWIPE_THRESHOLD_PX = 56
/** Ignore tiny jitter before treating a gesture as directional. */
const TOUCH_DIRECTION_SLOP_PX = 14
/**
 * During touchmove, if vertical movement is this much “steeper” than horizontal, assume the user is scrolling
 * and do not change slides on touchend.
 */
const VERTICAL_SCROLL_CANCEL_RATIO = 1.28
/** On touchend, horizontal distance must be at least this factor × vertical distance to count as a carousel swipe. */
const SWIPE_HORIZONTAL_DOMINANCE_RATIO = 1.35
/** Extra px so rounding / font rasterization does not let the live block exceed the locked shell height. */
const TEXT_SHELL_HEIGHT_BUFFER_PX = 6

function measureBlockHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect().height
  return Math.max(el.offsetHeight, el.scrollHeight, rect)
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return reduced
}

export interface HomeHeroSlide {
  title: string
  body: React.ReactNode
  imageAlt: string
  imageSources: {
    desktop: string
    tablet: string
    mobile: string
  }
}

export interface HomeHeroProps {
  /** At least 3 slides (Figma NEWHERO carousel). */
  slides: HomeHeroSlide[]
  primaryCtaLabel: string
  secondaryCtaLabel: string
  primaryCtaHref?: string
  secondaryCtaHref?: string
  /** Autoplay interval in ms; ignored when `prefers-reduced-motion: reduce`. */
  autoPlayMs?: number
  className?: string
}

const ChevronLeft: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M10 3L5 8l5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ChevronRight: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6 3l5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * Clone of the live copy block for measurement only (parent has aria-hidden).
 * Uses `h1` like the visible slide so height matches slide 1/2/3 when slide 3 is tallest.
 */
const HeroSlideMeasureCopy: React.FC<{ title: string; body: React.ReactNode }> = ({ title, body }) => (
  <div className="rs-home-hero__text-measure-item">
    <div className="rs-home-hero__title-wrap">
      <h1 className="rs-home-hero__title">{title}</h1>
    </div>
    <div className="rs-home-hero__body">{body}</div>
  </div>
)

const HomeHero: React.FC<HomeHeroProps> = ({
  slides,
  primaryCtaLabel,
  secondaryCtaLabel,
  primaryCtaHref = DEFAULT_IOS_APP_URL,
  secondaryCtaHref = DEFAULT_ANDROID_PLAY_URL,
  autoPlayMs = AUTO_PLAY_MS_DEFAULT,
  className = ''
}) => {
  const slideCount = slides.length
  const [index, setIndex] = useState(0)
  const [timerToken, setTimerToken] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  const restartAutoplay = useCallback(() => {
    setTimerToken((t) => t + 1)
  }, [])

  /** Set before each index change so the text pane can enter in the same direction as the carousel. */
  const textEnterDirRef = useRef<'next' | 'prev'>('next')
  /** Once true (autoplay, swipe, dots, arrows), slide changes animate; initial slide 0 stays static. */
  const heroCarouselEngagedRef = useRef(false)

  useEffect(() => {
    if (reducedMotion || slideCount < 2) return
    const id = window.setInterval(() => {
      heroCarouselEngagedRef.current = true
      textEnterDirRef.current = 'next'
      setIndex((i) => (i + 1) % slideCount)
    }, autoPlayMs)
    return () => window.clearInterval(id)
  }, [reducedMotion, slideCount, autoPlayMs, timerToken])

  const goPrev = useCallback(() => {
    heroCarouselEngagedRef.current = true
    textEnterDirRef.current = 'prev'
    setIndex((i) => (i - 1 + slideCount) % slideCount)
    restartAutoplay()
  }, [slideCount, restartAutoplay])

  const goNext = useCallback(() => {
    heroCarouselEngagedRef.current = true
    textEnterDirRef.current = 'next'
    setIndex((i) => (i + 1) % slideCount)
    restartAutoplay()
  }, [slideCount, restartAutoplay])

  const goTo = useCallback(
    (i: number) => {
      const normalized = ((i % slideCount) + slideCount) % slideCount
      setIndex((current) => {
        if (normalized === current) return current
        heroCarouselEngagedRef.current = true
        const forward = (normalized - current + slideCount) % slideCount
        const backward = (current - normalized + slideCount) % slideCount
        textEnterDirRef.current = forward <= backward ? 'next' : 'prev'
        return normalized
      })
      restartAutoplay()
    },
    [slideCount, restartAutoplay]
  )

  const safeIndex = slideCount > 0 ? Math.min(index, slideCount - 1) : 0
  const current = slides[safeIndex] ?? slides[0]

  const shouldAnimateHeroCarousel = !reducedMotion && heroCarouselEngagedRef.current
  const heroTextPaneClass = [
    'rs-home-hero__text-pane',
    shouldAnimateHeroCarousel ? `rs-home-hero__text-pane--enter-${textEnterDirRef.current}` : ''
  ]
    .filter(Boolean)
    .join(' ')

  const heroCtaDir = textEnterDirRef.current
  const heroCtaRowClass = [
    'rs-home-hero__cta-row',
    safeIndex === 0
      ? shouldAnimateHeroCarousel
        ? `rs-home-hero__cta-row--enter-${heroCtaDir}`
        : 'rs-home-hero__cta-row--at-rest-visible'
      : shouldAnimateHeroCarousel
        ? `rs-home-hero__cta-row--exit-${heroCtaDir}`
        : 'rs-home-hero__cta-row--at-rest-hidden'
  ].join(' ')

  const textShellRef = useRef<HTMLDivElement>(null)
  const measureRootRef = useRef<HTMLDivElement>(null)
  const visibleTextBlockRef = useRef<HTMLDivElement>(null)
  /** Locked height of the copy shell = tallest slide (clones + live), so CTAs don’t move when `space-between` runs on desktop. */
  const [tallestSlideTextPx, setTallestSlideTextPx] = useState<number | undefined>(undefined)

  const measureTallestSlideText = useCallback(() => {
    const root = measureRootRef.current
    const visible = visibleTextBlockRef.current
    let max = 0
    if (root) {
      const kids = Array.from(root.children) as HTMLElement[]
      kids.forEach((el) => {
        max = Math.max(max, measureBlockHeight(el))
      })
    }
    if (visible) {
      max = Math.max(max, measureBlockHeight(visible))
    }
    if (max <= 0) return
    setTallestSlideTextPx(Math.ceil(max) + TEXT_SHELL_HEIGHT_BUFFER_PX)
  }, [])

  const scheduleMeasure = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(measureTallestSlideText)
    })
  }, [measureTallestSlideText])

  useLayoutEffect(() => {
    measureTallestSlideText()
    const shell = textShellRef.current
    if (!shell) return
    const ro = new ResizeObserver(() => {
      scheduleMeasure()
    })
    ro.observe(shell)
    return () => ro.disconnect()
  }, [measureTallestSlideText, scheduleMeasure, slides])

  useLayoutEffect(() => {
    measureTallestSlideText()
  }, [safeIndex, measureTallestSlideText, current.title])

  useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) scheduleMeasure()
    })
    return () => {
      cancelled = true
    }
  }, [scheduleMeasure, slides])

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, slideCount - 1)))
  }, [slideCount])

  const touchStartRef = useRef<{ x: number; y: number; scrollIntent: boolean } | null>(null)

  const onHeroTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      scrollIntent: false
    }
  }, [])

  const onHeroTouchMove = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current
    if (!start || start.scrollIntent || e.touches.length !== 1) return
    const t = e.touches[0]
    const adx = Math.abs(t.clientX - start.x)
    const ady = Math.abs(t.clientY - start.y)
    if (ady < TOUCH_DIRECTION_SLOP_PX && adx < TOUCH_DIRECTION_SLOP_PX) return
    if (ady >= adx * VERTICAL_SCROLL_CANCEL_RATIO) {
      start.scrollIntent = true
    }
  }, [])

  const onHeroTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current
      touchStartRef.current = null
      if (!start || start.scrollIntent || slideCount < 2) return
      if (e.changedTouches.length !== 1) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      if (adx < SWIPE_THRESHOLD_PX) return
      if (adx < ady * SWIPE_HORIZONTAL_DOMINANCE_RATIO) return
      if (dx < 0) goNext()
      else goPrev()
    },
    [slideCount, goNext, goPrev]
  )

  const onHeroTouchCancel = useCallback(() => {
    touchStartRef.current = null
  }, [])

  if (slideCount === 0) {
    return null
  }

  return (
    <section
      className={['rs-home-hero', className].filter(Boolean).join(' ')}
      style={{ ['--rs-home-hero-autoplay-ms' as string]: `${autoPlayMs}ms` } as React.CSSProperties}
      aria-roledescription="carousel"
      aria-label="Featured"
      onTouchStart={onHeroTouchStart}
      onTouchMove={onHeroTouchMove}
      onTouchEnd={onHeroTouchEnd}
      onTouchCancel={onHeroTouchCancel}
    >
      <div className="rs-home-hero__inner-shadow" aria-hidden="true" />

      <div className="rs-home-hero__content">
        <div
          ref={textShellRef}
          className={[
            'rs-home-hero__text-shell',
            tallestSlideTextPx != null ? 'rs-home-hero__text-shell--locked' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            tallestSlideTextPx != null
              ? { minHeight: tallestSlideTextPx, height: tallestSlideTextPx }
              : undefined
          }
        >
          <div ref={measureRootRef} className="rs-home-hero__text-measure" aria-hidden="true">
            {slides.map((slide, i) => (
              <HeroSlideMeasureCopy key={i} title={slide.title} body={slide.body} />
            ))}
          </div>
          <div ref={visibleTextBlockRef} className="rs-home-hero__text-block" aria-live="polite">
            <div key={safeIndex} className={heroTextPaneClass}>
              <div className="rs-home-hero__title-wrap">
                <h1 className="rs-home-hero__title">{current.title}</h1>
              </div>
              <div className="rs-home-hero__body">{current.body}</div>
            </div>
          </div>
        </div>

        <div className="rs-home-hero__actions">
          <div className={heroCtaRowClass} aria-hidden={safeIndex > 0 ? true : undefined}>
            <Button variant="wide" shape="rounded" width="fill" href={primaryCtaHref}>
              {primaryCtaLabel}
            </Button>
            <Button variant="wide" shape="rounded" width="fill" href={secondaryCtaHref}>
              {secondaryCtaLabel}
            </Button>
          </div>

          <div className="rs-home-hero__carousel-bar">
            <div className="rs-home-hero__indicator-track" role="group" aria-label="Choose slide">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1} of ${slideCount}`}
                  aria-current={i === safeIndex ? 'true' : undefined}
                  className={[
                    'rs-home-hero__indicator',
                    i === safeIndex ? 'rs-home-hero__indicator--active' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => goTo(i)}
                >
                  {i === safeIndex && slideCount >= 2 && !reducedMotion ? (
                    <span
                      key={`${safeIndex}-${timerToken}`}
                      className="rs-home-hero__indicator-progress"
                      aria-hidden
                    />
                  ) : null}
                </button>
              ))}
            </div>
            <div className="rs-home-hero__nav-pair">
              <Button
                variant="circle"
                shape="rounded"
                type="button"
                ariaLabel="Previous slide"
                icon={<ChevronLeft />}
                instantAction
                onClick={goPrev}
              />
              <Button
                variant="circle"
                shape="rounded"
                type="button"
                ariaLabel="Next slide"
                icon={<ChevronRight />}
                instantAction
                onClick={goNext}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rs-home-hero__visual">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={['rs-home-hero__slide-visual', i === safeIndex ? 'is-active' : ''].filter(Boolean).join(' ')}
            aria-hidden={i !== safeIndex}
          >
            <picture>
              <source media="(min-width: 1024px)" srcSet={slide.imageSources.desktop} />
              <source media="(min-width: 640px)" srcSet={slide.imageSources.tablet} />
              <img
                className="rs-home-hero__image"
                src={slide.imageSources.mobile}
                alt={slide.imageAlt}
                loading={getOptimalImageLoading()}
                decoding="async"
                width={800}
                height={600}
              />
            </picture>
          </div>
        ))}
      </div>
    </section>
  )
}

export default HomeHero
export { DEFAULT_IMAGE_SOURCES }
