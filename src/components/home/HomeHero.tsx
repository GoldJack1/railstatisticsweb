import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Button from '../Button'
import HomeTopHeroImageStack, { type HomeTopHeroImageStackSources } from './HomeTopHeroImageStack'
import { DEFAULT_HERO_STACK_IMAGE_SOURCES, DEFAULT_HOMETOPHERO_IMAGE_SOURCES } from './homeTopHeroImageConstants'
import { useHomeTopHeroImageMotion } from './useHomeTopHeroImageMotion'
import './HomeHero.css'

/** @deprecated Use DEFAULT_HOMETOPHERO_IMAGE_SOURCES — same hometophero assets as HomeTopHero. */
const DEFAULT_IMAGE_SOURCES = DEFAULT_HOMETOPHERO_IMAGE_SOURCES

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
/** Same idea for the shared CTA row slot when any slide has buttons. */
const CTA_SLOT_HEIGHT_BUFFER_PX = 4
/** Must match `--home-hero-slide-*` on `.rs-home-hero` (exit + gap + enter + buffer before DOM unmount). */
const HERO_SLIDE_EXIT_MS = 380
const HERO_SLIDE_GAP_MS = 45
const HERO_SLIDE_ENTER_MS = 520
const HERO_SLIDE_SWAP_CLEAR_MS = HERO_SLIDE_EXIT_MS + HERO_SLIDE_GAP_MS + HERO_SLIDE_ENTER_MS + 50

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

/** Same URLs as `HomeTopHeroImageStack`: dark/light × desktop-tablet / mobile. */
export type HomeHeroSlideImageSources = HomeTopHeroImageStackSources

export interface HomeHeroSlideCta {
  label: string
  /** Renders as `<a>` (same as HomeTopHero download). Omit to use `onClick` on a `<button>`. */
  href?: string
  target?: React.HTMLAttributeAnchorTarget
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
}

export interface HomeHeroSlide {
  title: string
  body: React.ReactNode
  /** Optional row below body; one button uses TopHero width cap, two+ share desktop row rules in CSS. */
  ctas?: HomeHeroSlideCta[]
  /** Meaningful description if the slide art conveys information (visual is `aria-hidden` today). */
  imageAlt?: string
  /**
   * Per-slide hero art. Omitted keys use default hometophero URLs.
   * Wide-desktop art uses `(min-width: 1200px)`; mobile + tablet below that (matches HomeHero layout).
   */
  imageSources?: Partial<HomeHeroSlideImageSources>
}

function mergeHomeHeroSlideSources(slide: HomeHeroSlide): HomeTopHeroImageStackSources {
  const base = DEFAULT_HERO_STACK_IMAGE_SOURCES
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
export type HomeHeroContentFill = 'bgSecondary' | 'heroTint'

export interface HomeHeroProps {
  /** At least 3 slides (Figma NEWHERO carousel). */
  slides: HomeHeroSlide[]
  /** Autoplay interval in ms; ignored when `prefers-reduced-motion: reduce`. */
  autoPlayMs?: number
  className?: string
  /**
   * `bgSecondary` (default): gradient solid uses `var(--bg-secondary)`.
   * `heroTint`: solid matches the hometophero band (`hsl(0 100% 92%)` / dark `hsl(0 100% 8%)`).
   */
  contentFill?: HomeHeroContentFill
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

const HeroSlideCtaRow: React.FC<{ ctas?: HomeHeroSlideCta[] }> = ({ ctas }) => {
  if (!ctas?.length) return null
  const multi = ctas.length > 1
  return (
    <div
      className={[
        'rs-home-hero__slide-ctas',
        multi ? 'rs-home-hero__slide-ctas--multi' : 'rs-home-hero__slide-ctas--single'
      ].join(' ')}
    >
      <div className="rs-home-hero__slide-ctas-inner">
        {ctas.map((cta, i) => (
          <div key={i} className="rs-home-hero__slide-cta-wrap">
            <Button
              variant="wide"
              shape="rounded"
              width="fill"
              colorVariant="accent"
              className="rs-home-top-hero__cta"
              href={cta.href}
              target={cta.target}
              onClick={cta.onClick}
              type="button"
              instantAction={!cta.href && Boolean(cta.onClick)}
            >
              {cta.label}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Measure title + body only — CTAs render outside the locked shell so they sit above the carousel. */
const HeroSlideTextContent: React.FC<{ title: string; body: React.ReactNode }> = ({ title, body }) => (
  <>
    <div className="rs-home-hero__title-wrap">
      <h1 className="rs-home-hero__title">{title}</h1>
    </div>
    <div className="rs-home-hero__body">{body}</div>
  </>
)

const HeroSlideMeasureCopy: React.FC<{ slide: Pick<HomeHeroSlide, 'title' | 'body'> }> = ({ slide }) => (
  <div className="rs-home-hero__text-measure-item">
    <HeroSlideTextContent title={slide.title} body={slide.body} />
  </div>
)

const HomeHero: React.FC<HomeHeroProps> = ({
  slides,
  autoPlayMs = AUTO_PLAY_MS_DEFAULT,
  className = '',
  contentFill = 'bgSecondary'
}) => {
  const slideCount = slides.length
  const [index, setIndex] = useState(0)
  const [timerToken, setTimerToken] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  const restartAutoplay = useCallback(() => {
    setTimerToken((t) => t + 1)
  }, [])

  /** Once true (autoplay, swipe, dots, arrows), slide changes animate; initial slide 0 stays static. */
  const heroCarouselEngagedRef = useRef(false)
  /** Previous slide index while an outgoing copy is fading out (Y-fade) over the incoming pane. */
  const [outgoingSlideIndex, setOutgoingSlideIndex] = useState<number | null>(null)
  const prevSafeIndexRef = useRef(0)
  const swapClearTimeoutRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; scrollIntent: boolean } | null>(null)

  useEffect(() => {
    if (reducedMotion || slideCount < 2) return
    const id = window.setInterval(() => {
      heroCarouselEngagedRef.current = true
      setIndex((i) => (i + 1) % slideCount)
    }, autoPlayMs)
    return () => window.clearInterval(id)
  }, [reducedMotion, slideCount, autoPlayMs, timerToken])

  const goPrev = useCallback(() => {
    heroCarouselEngagedRef.current = true
    setIndex((i) => (i - 1 + slideCount) % slideCount)
    restartAutoplay()
  }, [slideCount, restartAutoplay])

  const goNext = useCallback(() => {
    heroCarouselEngagedRef.current = true
    setIndex((i) => (i + 1) % slideCount)
    restartAutoplay()
  }, [slideCount, restartAutoplay])

  const goTo = useCallback(
    (i: number) => {
      const normalized = ((i % slideCount) + slideCount) % slideCount
      setIndex((current) => {
        if (normalized === current) return current
        heroCarouselEngagedRef.current = true
        return normalized
      })
      restartAutoplay()
    },
    [slideCount, restartAutoplay]
  )

  const safeIndex = slideCount > 0 ? Math.min(index, slideCount - 1) : 0
  const current = slides[safeIndex] ?? slides[0]

  const maxCtaCountAcrossSlides = useMemo(
    () => slides.reduce((max, s) => Math.max(max, s.ctas?.length ?? 0), 0),
    [slides]
  )
  const homeHeroCtaBand: '0' | '1' | '2' =
    maxCtaCountAcrossSlides >= 2 ? '2' : maxCtaCountAcrossSlides === 1 ? '1' : '0'

  const shouldAnimateHeroCarousel = !reducedMotion && heroCarouselEngagedRef.current
  /** Outgoing state updates in `useLayoutEffect`; compare ref so enter-y applies on first paint of the new slide. */
  const slideCrossfadeActive =
    shouldAnimateHeroCarousel &&
    (outgoingSlideIndex !== null || prevSafeIndexRef.current !== safeIndex)

  const heroTextPaneClass = [
    'rs-home-hero__text-pane',
    slideCrossfadeActive ? 'rs-home-hero__text-pane--enter-y' : ''
  ]
    .filter(Boolean)
    .join(' ')

  const ctaSwapEnterClass = slideCrossfadeActive ? 'rs-home-hero__cta-row--enter-y' : ''

  const heroSectionRef = useRef<HTMLElement | null>(null)
  useHomeTopHeroImageMotion(heroSectionRef, slideCount > 0)

  const textShellRef = useRef<HTMLDivElement>(null)
  const measureRootRef = useRef<HTMLDivElement>(null)
  const visibleTextBlockRef = useRef<HTMLDivElement>(null)
  const ctaMeasureRootRef = useRef<HTMLDivElement>(null)
  const ctaSlotInnerRef = useRef<HTMLDivElement>(null)
  /** Locked height of the copy shell = tallest title+body (clones + live); CTAs live outside the shell above the carousel. */
  const [tallestSlideTextPx, setTallestSlideTextPx] = useState<number | undefined>(undefined)
  /** When any slide has CTAs, all slides reserve this min height so the carousel line stays aligned. */
  const [tallestCtaRowPx, setTallestCtaRowPx] = useState<number | undefined>(undefined)

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

  const measureTallestCtaRow = useCallback(() => {
    if (maxCtaCountAcrossSlides === 0) {
      setTallestCtaRowPx(undefined)
      return
    }
    let max = 0
    const measureRoot = ctaMeasureRootRef.current
    if (measureRoot) {
      const kids = Array.from(measureRoot.children) as HTMLElement[]
      kids.forEach((el) => {
        max = Math.max(max, measureBlockHeight(el))
      })
    }
    // Measure the live row wrapper, not `.cta-slot-inner` — the inner is `flex:1` and fills the slot
    // `minHeight`, so its box height tracks state and would ratchet `tallestCtaRowPx` up on every resize.
    const live = ctaSlotInnerRef.current
    const liveRow = live?.firstElementChild
    if (liveRow instanceof HTMLElement) {
      max = Math.max(max, measureBlockHeight(liveRow))
    }
    if (max <= 0) return
    setTallestCtaRowPx(Math.ceil(max) + CTA_SLOT_HEIGHT_BUFFER_PX)
  }, [maxCtaCountAcrossSlides])

  const scheduleMeasure = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        measureTallestSlideText()
        measureTallestCtaRow()
      })
    })
  }, [measureTallestSlideText, measureTallestCtaRow])

  useLayoutEffect(() => {
    scheduleMeasure()
    const shell = textShellRef.current
    if (!shell) return
    const ro = new ResizeObserver(() => {
      scheduleMeasure()
    })
    ro.observe(shell)
    return () => ro.disconnect()
  }, [scheduleMeasure, slides])

  useLayoutEffect(() => {
    if (maxCtaCountAcrossSlides === 0) return
    const el = ctaMeasureRootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      scheduleMeasure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxCtaCountAcrossSlides, scheduleMeasure, slides])

  useLayoutEffect(() => {
    measureTallestSlideText()
    measureTallestCtaRow()
  }, [
    safeIndex,
    measureTallestSlideText,
    measureTallestCtaRow,
    current.title,
    current.ctas?.length
  ])

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
    setOutgoingSlideIndex(null)
    setIndex((i) => Math.min(i, Math.max(0, slideCount - 1)))
  }, [slideCount])

  useLayoutEffect(() => {
    if (prevSafeIndexRef.current === safeIndex) return
    if (!heroCarouselEngagedRef.current || reducedMotion) {
      prevSafeIndexRef.current = safeIndex
      setOutgoingSlideIndex(null)
      return
    }
    const leaving = prevSafeIndexRef.current
    prevSafeIndexRef.current = safeIndex
    if (swapClearTimeoutRef.current) {
      clearTimeout(swapClearTimeoutRef.current)
    }
    setOutgoingSlideIndex(leaving)
    swapClearTimeoutRef.current = window.setTimeout(() => {
      setOutgoingSlideIndex(null)
      swapClearTimeoutRef.current = null
    }, HERO_SLIDE_SWAP_CLEAR_MS)
    return () => {
      if (swapClearTimeoutRef.current) {
        clearTimeout(swapClearTimeoutRef.current)
        swapClearTimeoutRef.current = null
      }
    }
  }, [safeIndex, reducedMotion])

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

  const outgoingSlide =
    outgoingSlideIndex !== null && outgoingSlideIndex >= 0 && outgoingSlideIndex < slideCount
      ? slides[outgoingSlideIndex]
      : null

  if (slideCount === 0) {
    return null
  }

  return (
    <section
      ref={heroSectionRef}
      className={[
        'rs-home-hero',
        contentFill === 'heroTint' ? 'rs-home-hero--content-fill-hero-tint' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      data-home-hero-cta-band={homeHeroCtaBand}
      style={{ ['--rs-home-hero-autoplay-ms' as string]: `${autoPlayMs}ms` } as React.CSSProperties}
      aria-roledescription="carousel"
      aria-label="Featured"
      onTouchStart={onHeroTouchStart}
      onTouchMove={onHeroTouchMove}
      onTouchEnd={onHeroTouchEnd}
      onTouchCancel={onHeroTouchCancel}
    >
      <div className="rs-home-hero__visual" aria-hidden="true">
        <HomeTopHeroImageStack
          key={safeIndex}
          variant="homeHero"
          loading="lazy"
          sources={mergeHomeHeroSlideSources(current)}
          alt={current.imageAlt ?? ''}
        />
      </div>

      <div className="rs-home-hero__content">
        {maxCtaCountAcrossSlides > 0 ? (
          <div ref={ctaMeasureRootRef} className="rs-home-hero__cta-measure" aria-hidden="true">
            {slides.map((slide, i) =>
              slide.ctas?.length ? (
                <div key={i} className="rs-home-hero__cta-measure-item">
                  <HeroSlideCtaRow ctas={slide.ctas} />
                </div>
              ) : null
            )}
          </div>
        ) : null}

        <div className="rs-home-hero__copy-stack">
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
                <HeroSlideMeasureCopy key={i} slide={slide} />
              ))}
            </div>
            <div className="rs-home-hero__text-block rs-home-hero__text-block--swap" aria-live="polite">
              {outgoingSlide ? (
                <div className="rs-home-hero__text-pane-outgoing" aria-hidden="true">
                  <div className="rs-home-hero__text-pane rs-home-hero__text-pane--exit-y">
                    <HeroSlideTextContent title={outgoingSlide.title} body={outgoingSlide.body} />
                  </div>
                </div>
              ) : null}
              <div ref={visibleTextBlockRef} className="rs-home-hero__text-pane-incoming">
                <div key={safeIndex} className={heroTextPaneClass}>
                  <HeroSlideTextContent title={current.title} body={current.body} />
                </div>
              </div>
            </div>
          </div>

          {maxCtaCountAcrossSlides > 0 ? (
            <div
              className={[
                'rs-home-hero__cta-slot',
                tallestCtaRowPx != null ? 'rs-home-hero__cta-slot--locked' : '',
                'rs-home-hero__cta-slot--swap'
              ]
                .filter(Boolean)
                .join(' ')}
              style={tallestCtaRowPx != null ? { minHeight: tallestCtaRowPx } : undefined}
            >
              {outgoingSlide?.ctas?.length ? (
                <div className="rs-home-hero__cta-outgoing" aria-hidden="true">
                  <div className="rs-home-hero__cta-exit-wrap rs-home-hero__cta-row--exit-y">
                    <HeroSlideCtaRow ctas={outgoingSlide.ctas} />
                  </div>
                </div>
              ) : null}
              <div ref={ctaSlotInnerRef} className="rs-home-hero__cta-slot-inner">
                {current.ctas?.length ? (
                  <div
                    key={safeIndex}
                    className={['rs-home-hero__cta-enter-wrap', ctaSwapEnterClass].filter(Boolean).join(' ')}
                  >
                    <HeroSlideCtaRow ctas={current.ctas} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rs-home-hero__actions">
          <div className="rs-home-hero__carousel-bar">
            <Button
              variant="circle"
              shape="rounded"
              type="button"
              ariaLabel="Previous slide"
              icon={<ChevronLeft />}
              onClick={goPrev}
            />
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
            <Button
              variant="circle"
              shape="rounded"
              type="button"
              ariaLabel="Next slide"
              icon={<ChevronRight />}
              onClick={goNext}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeHero
export { DEFAULT_IMAGE_SOURCES, DEFAULT_HOMETOPHERO_IMAGE_SOURCES, DEFAULT_HERO_STACK_IMAGE_SOURCES }
