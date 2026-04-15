/**
 * Reusable full-bleed carousel hero: arbitrary slide count, per-slide copy/CTAs, and per-slide
 * light/dark + mobile/desktop art via `CarouselHeroSlide.imageSources` (merged with `defaultImageSources`).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Button from '../Button'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import HeroImageStack, {
  type HeroImageStackSources,
  type HeroMobileTabletUncroppedSettings
} from './HeroImageStack'
import { DEFAULT_HERO_STACK_IMAGE_SOURCES } from './heroImageConstants'
import {
  HeroSlideCtaRow,
  HeroSlideMeasureCopy,
  HeroSlideTextContent,
  type HeroTitleHeadingLevel
} from './HeroSlideCopy'
import {
  mergeCarouselHeroSlideSources,
  type CarouselHeroContentFill,
  type CarouselHeroSlide,
  type HeroDesktopPanelSide,
  type HeroMediaCropMode,
  type HeroMobilePanelPosition,
  type HeroTextStyle
} from './heroCarouselSlideModel'
import {
  CTA_SLOT_HEIGHT_BUFFER_PX,
  measureBlockHeight,
  scheduleDoubleRaf,
  TEXT_SHELL_HEIGHT_BUFFER_PX
} from './heroMeasure'
import { getHeroSlideSwapClearTimeoutMs, heroCopySlideCssVarProperties } from './heroSlideAnimationTokens'
import { unionDOMRects, useScrollDirectionFadeBounds } from '../../hooks/useScrollDirectionFade'
import { scrollFadeRevealClassNames } from '../ScrollFadeReveal'
import '../ScrollFadeReveal.css'
import { useHeroImageMotion } from './useHeroImageMotion'
import { useLockedHeroTextBlockScroll } from './useLockedHeroTextBlockScroll'
import './CarouselHero.css'

/* Re-export slide model next to the component for import ergonomics. */
/* eslint-disable react-refresh/only-export-components */
export type {
  CarouselHeroSlideImageSources,
  CarouselHeroSlideCta,
  CarouselHeroSlide,
  CarouselHeroContentFill,
  HeroDesktopPanelSide,
  HeroMediaCropMode,
  HeroMobilePanelPosition,
  HeroTextStyle
} from './heroCarouselSlideModel'
export { mergeCarouselHeroSlideSources } from './heroCarouselSlideModel'
/* eslint-enable react-refresh/only-export-components */

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

const NS = 'carousel' as const
const LOCKED_TEXT_BLOCK_SCROLL_CLASS = 'rs-carousel-hero__text-block--scroll-y'

export interface CarouselHeroProps {
  /** Any number of slides ≥ 1; navigation chrome hides when only one slide. */
  slides: CarouselHeroSlide[]
  /**
   * Defaults merged into each slide’s `imageSources` (per-slide partials override).
   * Defaults to shared hometophero assets when omitted.
   */
  defaultImageSources?: HeroImageStackSources
  /** Autoplay interval in ms; ignored when `prefers-reduced-motion: reduce`. */
  autoPlayMs?: number
  /** Optional per-slide autoplay overrides in ms (index-aligned with `slides`). */
  slideAutoPlayMs?: number[]
  className?: string
  /** `aria-label` on the carousel region (default: Featured). */
  ariaLabel?: string
  /**
   * `bgSecondary` (default): gradient solid uses `var(--bg-secondary)`.
   * `heroTint`: solid matches the hero band (`hsl(354 100% 85%)` / dark `hsl(0 100% 8%)`).
   */
  contentFill?: CarouselHeroContentFill
  /**
   * Pause autoplay while the pointer is over the carousel chrome (prev/next, dots, pause)
   * — not the copy/CTA panel — so reading the hero does not freeze slides (ignored when reduced motion).
   * Manual navigation clears this pause so autoplay can resume without moving the pointer off the bar.
   */
  pauseOnHover?: boolean
  /** Pause autoplay while focus is inside the hero (keyboard users). */
  pauseOnFocusWithin?: boolean
  /** Desktop splash typography (≥1200px); layout matches default carousel band. */
  textStyle?: HeroTextStyle
  /** Semantic level for the visible title (default `1` for a primary page carousel). */
  titleHeadingLevel?: HeroTitleHeadingLevel
  /** ≥1200px: copy panel on the start half (left in LTR) or end half (right). */
  desktopPanelSide?: HeroDesktopPanelSide
  /** Below 1200px: stack copy toward the bottom (default) or top of the hero band. */
  mobilePanelPosition?: HeroMobilePanelPosition
  /** Mobile/tablet media framing default for all slides. */
  mobileTabletMediaMode?: HeroMediaCropMode
  /** Optional default max scale cap for mobile/tablet uncropped slides. */
  mobileTabletUncroppedMaxScale?: number
  /** Optional default uncropped tuning for mobile/tablet slides. */
  mobileTabletUncroppedSettings?: HeroMobileTabletUncroppedSettings
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

const AutoplayPauseIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <rect x="2" y="1.5" width="2" height="7" rx="0.5" fill="currentColor" />
    <rect x="6" y="1.5" width="2" height="7" rx="0.5" fill="currentColor" />
  </svg>
)

const AutoplayPlayIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M2.5 1.5L8.5 5 2.5 8.5V1.5Z" fill="currentColor" />
  </svg>
)

const CarouselHero: React.FC<CarouselHeroProps> = ({
  slides,
  defaultImageSources = DEFAULT_HERO_STACK_IMAGE_SOURCES,
  autoPlayMs = AUTO_PLAY_MS_DEFAULT,
  slideAutoPlayMs,
  className = '',
  contentFill = 'bgSecondary',
  ariaLabel = 'Featured',
  pauseOnHover = true,
  pauseOnFocusWithin = true,
  textStyle = 'hero',
  titleHeadingLevel = 1,
  desktopPanelSide = 'left',
  mobilePanelPosition = 'bottom',
  mobileTabletMediaMode = 'cropped',
  mobileTabletUncroppedMaxScale,
  mobileTabletUncroppedSettings
}) => {
  const slideCount = slides.length
  const [index, setIndex] = useState(0)
  /** Strip translate index; may equal `slideCount` when showing the trailing clone of slide 0 (forward wrap). */
  const [stripVisualIndex, setStripVisualIndex] = useState(0)
  /** One frame: disable strip transition while snapping clone → real first cell. */
  const [stripInstantReset, setStripInstantReset] = useState(false)
  const [timerToken, setTimerToken] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const [hoverPaused, setHoverPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const [autoplayUserPaused, setAutoplayUserPaused] = useState(false)
  const autoplaySuspended =
    reducedMotion ||
    (pauseOnHover && hoverPaused) ||
    (pauseOnFocusWithin && focusPaused) ||
    autoplayUserPaused
  const [liveStatus, setLiveStatus] = useState('')
  const announceIndexRef = useRef<number | null>(null)
  const stripVisualIndexRef = useRef(0)
  /** Logical index the strip is committed to (stays at `slideCount - 1` until clone snap after forward wrap). */
  const stripSyncedLogicalRef = useRef(0)
  const prevSlideCountForStripRef = useRef(slideCount)

  const restartAutoplay = useCallback(() => {
    setTimerToken((t) => t + 1)
  }, [])

  /** Once true (autoplay, swipe, dots, arrows), slide changes animate; initial slide 0 stays static. */
  const carouselEngagedRef = useRef(false)
  /** Previous slide index while an outgoing copy is fading out (Y-fade) over the incoming pane. */
  const [outgoingSlideIndex, setOutgoingSlideIndex] = useState<number | null>(null)
  const prevSafeIndexRef = useRef(0)
  const swapClearTimeoutRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; scrollIntent: boolean } | null>(null)
  const safeIndex = slideCount > 0 ? Math.min(index, slideCount - 1) : 0
  const current = slides[safeIndex] ?? slides[0]
  const activeAutoPlayMs = current?.autoPlayMs ?? slideAutoPlayMs?.[safeIndex] ?? autoPlayMs

  useEffect(() => {
    if (autoplaySuspended || slideCount < 2) return
    const id = window.setInterval(() => {
      carouselEngagedRef.current = true
      setIndex((i) => (i + 1) % slideCount)
    }, activeAutoPlayMs)
    return () => window.clearInterval(id)
  }, [autoplaySuspended, slideCount, activeAutoPlayMs, timerToken])

  const goPrev = useCallback(() => {
    carouselEngagedRef.current = true
    if (pauseOnHover) setHoverPaused(false)
    setIndex((i) => (i - 1 + slideCount) % slideCount)
    restartAutoplay()
  }, [pauseOnHover, slideCount, restartAutoplay])

  const goNext = useCallback(() => {
    carouselEngagedRef.current = true
    if (pauseOnHover) setHoverPaused(false)
    setIndex((i) => (i + 1) % slideCount)
    restartAutoplay()
  }, [pauseOnHover, slideCount, restartAutoplay])

  const goTo = useCallback(
    (i: number) => {
      const normalized = ((i % slideCount) + slideCount) % slideCount
      if (pauseOnHover) setHoverPaused(false)
      setIndex((current) => {
        if (normalized === current) return current
        carouselEngagedRef.current = true
        return normalized
      })
      restartAutoplay()
    },
    [pauseOnHover, slideCount, restartAutoplay]
  )

  const useStripClone = slideCount >= 2 && !reducedMotion
  const stripCellCount = useStripClone ? slideCount + 1 : Math.max(slideCount, 1)
  const stripIndexForCss = useStripClone ? stripVisualIndex : safeIndex

  useLayoutEffect(() => {
    stripVisualIndexRef.current = stripVisualIndex
  }, [stripVisualIndex])

  useLayoutEffect(() => {
    if (slideCount < 2 || reducedMotion) {
      setStripVisualIndex(safeIndex)
      stripSyncedLogicalRef.current = safeIndex
      prevSlideCountForStripRef.current = slideCount
      return
    }
    if (prevSlideCountForStripRef.current !== slideCount) {
      prevSlideCountForStripRef.current = slideCount
      stripSyncedLogicalRef.current = safeIndex
      setStripVisualIndex(safeIndex)
      return
    }
    const synced = stripSyncedLogicalRef.current
    if (synced === slideCount - 1 && safeIndex === 0) {
      setStripVisualIndex(slideCount)
      return
    }
    setStripVisualIndex(safeIndex)
    stripSyncedLogicalRef.current = safeIndex
  }, [safeIndex, slideCount, reducedMotion])

  useLayoutEffect(() => {
    if (!stripInstantReset) return
    setStripInstantReset(false)
  }, [stripInstantReset])

  const onImageStripTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.propertyName !== 'transform') return
      if (slideCount < 2 || reducedMotion) return
      if (stripVisualIndexRef.current !== slideCount) return
      setStripInstantReset(true)
      setStripVisualIndex(0)
      stripSyncedLogicalRef.current = 0
    },
    [slideCount, reducedMotion]
  )

  const maxCtaCountAcrossSlides = useMemo(
    () => slides.reduce((max, s) => Math.max(max, s.ctas?.length ?? 0), 0),
    [slides]
  )
  const carouselHeroCtaBand: '0' | '1' | '2' =
    maxCtaCountAcrossSlides >= 2 ? '2' : maxCtaCountAcrossSlides === 1 ? '1' : '0'

  const shouldAnimateCarousel = !reducedMotion && carouselEngagedRef.current
  /** Outgoing state updates in `useLayoutEffect`; compare ref so enter-y applies on first paint of the new slide. */
  const slideCrossfadeActive =
    shouldAnimateCarousel &&
    (outgoingSlideIndex !== null || prevSafeIndexRef.current !== safeIndex)

  const carouselTextPaneClass = [
    'rs-carousel-hero__text-pane',
    slideCrossfadeActive ? 'rs-carousel-hero__text-pane--enter-y' : ''
  ]
    .filter(Boolean)
    .join(' ')

  const ctaSwapEnterClass = slideCrossfadeActive ? 'rs-carousel-hero__cta-row--enter-y' : ''

  const carouselSectionRef = useRef<HTMLElement | null>(null)

  const textShellRef = useRef<HTMLDivElement>(null)
  const textBlockRef = useRef<HTMLDivElement>(null)
  const measureRootRef = useRef<HTMLDivElement>(null)
  const visibleTextBlockRef = useRef<HTMLDivElement>(null)
  const ctaMeasureRootRef = useRef<HTMLDivElement>(null)
  const ctaSlotInnerRef = useRef<HTMLDivElement>(null)
  const scrollFadeVisualRef = useRef<HTMLDivElement>(null)
  const scrollFadeCopyRef = useRef<HTMLDivElement>(null)
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
    scheduleDoubleRaf(() => {
      measureTallestSlideText()
      measureTallestCtaRow()
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
  }, [scheduleMeasure, slides, textStyle])

  useLayoutEffect(() => {
    if (maxCtaCountAcrossSlides === 0) return
    const el = ctaMeasureRootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      scheduleMeasure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxCtaCountAcrossSlides, scheduleMeasure, slides, textStyle])

  useLayoutEffect(() => {
    measureTallestSlideText()
    measureTallestCtaRow()
  }, [
    safeIndex,
    measureTallestSlideText,
    measureTallestCtaRow,
    current.title,
    current.ctas?.length,
    textStyle,
    titleHeadingLevel
  ])

  const textBlockScrollLayoutKey = `${tallestSlideTextPx ?? ''}|${safeIndex}|${textStyle}|${titleHeadingLevel}`
  useLockedHeroTextBlockScroll(
    textBlockRef,
    tallestSlideTextPx != null,
    LOCKED_TEXT_BLOCK_SCROLL_CLASS,
    textBlockScrollLayoutKey
  )

  useHeroImageMotion(carouselSectionRef, slideCount > 0, {
    ancestorScrollRoots: [textBlockRef],
    ancestorScrollResyncKey: textBlockScrollLayoutKey
  })

  const getScrollFadeUnionBounds = useCallback((): DOMRect | null => {
    const a = scrollFadeVisualRef.current?.getBoundingClientRect() ?? null
    const b = scrollFadeCopyRef.current?.getBoundingClientRect() ?? null
    if (a && b) return unionDOMRects(a, b)
    return a ?? b
  }, [])

  const scrollFadeLayoutBust = `${safeIndex}|${tallestSlideTextPx ?? ''}|${tallestCtaRowPx ?? ''}|${outgoingSlideIndex ?? ''}|${stripVisualIndex}|${stripCellCount}|${current?.title ?? ''}`

  const scrollFadeVisible = useScrollDirectionFadeBounds(getScrollFadeUnionBounds, scrollFadeLayoutBust)

  useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) scheduleMeasure()
    })
    return () => {
      cancelled = true
    }
  }, [scheduleMeasure, slides, textStyle])

  useEffect(() => {
    setOutgoingSlideIndex(null)
    setIndex((i) => Math.min(i, Math.max(0, slideCount - 1)))
  }, [slideCount])

  useLayoutEffect(() => {
    if (prevSafeIndexRef.current === safeIndex) return
    if (!carouselEngagedRef.current || reducedMotion) {
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
    }, getHeroSlideSwapClearTimeoutMs())
    return () => {
      if (swapClearTimeoutRef.current) {
        clearTimeout(swapClearTimeoutRef.current)
        swapClearTimeoutRef.current = null
      }
    }
  }, [safeIndex, reducedMotion])

  useEffect(() => {
    if (slideCount < 2) {
      setAutoplayUserPaused(false)
    }
  }, [slideCount])

  useEffect(() => {
    if (slideCount < 2 || reducedMotion) {
      announceIndexRef.current = safeIndex
      return
    }
    if (!carouselEngagedRef.current) {
      announceIndexRef.current = safeIndex
      return
    }
    if (announceIndexRef.current === null) {
      announceIndexRef.current = safeIndex
      return
    }
    if (announceIndexRef.current === safeIndex) return
    announceIndexRef.current = safeIndex
    setLiveStatus(`Slide ${safeIndex + 1} of ${slideCount}: ${current.title}`)
  }, [slideCount, reducedMotion, safeIndex, current.title])

  const onCarouselChromePointerEnter = useCallback(() => {
    if (pauseOnHover) setHoverPaused(true)
  }, [pauseOnHover])

  const onCarouselChromePointerLeave = useCallback(() => {
    if (pauseOnHover) setHoverPaused(false)
  }, [pauseOnHover])

  /** Only the carousel chrome (arrows / dots / pause) — not slide copy or CTAs — should pause autoplay on focus. */
  const onCarouselChromeFocus = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!pauseOnFocusWithin) return
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest('.rs-carousel-hero__indicator-autoplay-toggle')) return
      // Mouse clicks move focus onto prev/next/dots; :focus-visible is false — keep autoplay running.
      // Keyboard focus shows a ring and should pause until the user leaves the chrome.
      try {
        if (typeof t.matches === 'function' && !t.matches(':focus-visible')) return
      } catch {
        /* :focus-visible unsupported — fall through and pause */
      }
      setFocusPaused(true)
    },
    [pauseOnFocusWithin]
  )

  const onCarouselChromeBlur = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!pauseOnFocusWithin) return
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setFocusPaused(false)
    },
    [pauseOnFocusWithin]
  )

  const onCarouselTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      scrollIntent: false
    }
  }, [])

  const onCarouselTouchMove = useCallback((e: React.TouchEvent) => {
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

  const onCarouselTouchEnd = useCallback(
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

  const onCarouselTouchCancel = useCallback(() => {
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
      ref={carouselSectionRef}
      className={[
        'rs-carousel-hero',
        contentFill === 'heroTint' ? 'rs-carousel-hero--content-fill-hero-tint' : '',
        textStyle === 'splash' ? 'rs-carousel-hero--text-splash' : '',
        autoplayUserPaused ? 'rs-carousel-hero--autoplay-user-paused' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      data-carousel-hero-cta-band={carouselHeroCtaBand}
      data-hero-desktop-panel={desktopPanelSide === 'right' ? 'right' : undefined}
      data-hero-mobile-panel={mobilePanelPosition === 'top' ? 'top' : undefined}
      style={
        {
          ...heroCopySlideCssVarProperties('carousel'),
          ['--rs-carousel-hero-autoplay-ms' as string]: `${activeAutoPlayMs}ms`,
          ['--carousel-hero-slide-count' as string]: String(stripCellCount),
          ['--carousel-hero-slide-index' as string]: String(stripIndexForCss)
        } as React.CSSProperties
      }
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onTouchStart={onCarouselTouchStart}
      onTouchMove={onCarouselTouchMove}
      onTouchEnd={onCarouselTouchEnd}
      onTouchCancel={onCarouselTouchCancel}
    >
      <div className="rs-carousel-hero__sr-live" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>
      <div className="rs-carousel-hero__visual" aria-hidden="true">
        <div
          ref={scrollFadeVisualRef}
          className={`rs-carousel-hero__visual-art ${scrollFadeRevealClassNames(scrollFadeVisible)}`}
        >
          <div
            className={[
              'rs-carousel-hero-image-strip',
              stripInstantReset ? 'rs-carousel-hero-image-strip--instant' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onTransitionEnd={onImageStripTransitionEnd}
          >
          {slides.map((slide, i) => (
            <div key={i} className="rs-carousel-hero-image-strip__cell">
              <HeroImageStack
                variant="carousel"
                loading="lazy"
                sources={mergeCarouselHeroSlideSources(slide, defaultImageSources)}
                videoSources={slide.videoSources}
                mobileTabletMediaMode={slide.mobileTabletMediaMode ?? mobileTabletMediaMode}
                mobileTabletUncroppedMaxScale={
                  slide.mobileTabletUncroppedMaxScale ?? mobileTabletUncroppedMaxScale
                }
                mobileTabletUncroppedSettings={
                  slide.mobileTabletUncroppedSettings ?? mobileTabletUncroppedSettings
                }
                isActive={i === safeIndex}
                videoLoop={Boolean(slide.videoSources)}
                alt={slide.imageAlt ?? ''}
              />
            </div>
          ))}
          {useStripClone ? (
            <div key="strip-clone-0" className="rs-carousel-hero-image-strip__cell">
              <HeroImageStack
                variant="carousel"
                loading="lazy"
                sources={mergeCarouselHeroSlideSources(slides[0], defaultImageSources)}
                videoSources={slides[0].videoSources}
                mobileTabletMediaMode={slides[0].mobileTabletMediaMode ?? mobileTabletMediaMode}
                mobileTabletUncroppedMaxScale={
                  slides[0].mobileTabletUncroppedMaxScale ?? mobileTabletUncroppedMaxScale
                }
                mobileTabletUncroppedSettings={
                  slides[0].mobileTabletUncroppedSettings ?? mobileTabletUncroppedSettings
                }
                isActive={safeIndex === 0}
                videoLoop={Boolean(slides[0].videoSources)}
                alt={slides[0].imageAlt ?? ''}
              />
            </div>
          ) : null}
          </div>
        </div>
      </div>

      <div className="rs-carousel-hero__content">
        {maxCtaCountAcrossSlides > 0 ? (
          <div ref={ctaMeasureRootRef} className="rs-carousel-hero__cta-measure" aria-hidden="true">
            {slides.map((slide, i) =>
              slide.ctas?.length ? (
                <div key={i} className="rs-carousel-hero__cta-measure-item">
                  <HeroSlideCtaRow namespace={NS} ctas={slide.ctas} />
                </div>
              ) : null
            )}
          </div>
        ) : null}

        <div
          ref={scrollFadeCopyRef}
          className={`rs-carousel-hero__copy-stack ${scrollFadeRevealClassNames(scrollFadeVisible)}`}
        >
          <div
            ref={textShellRef}
            className={[
              'rs-carousel-hero__text-shell',
              tallestSlideTextPx != null ? 'rs-carousel-hero__text-shell--locked' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              tallestSlideTextPx != null
                ? { minHeight: tallestSlideTextPx, height: tallestSlideTextPx }
                : undefined
            }
          >
            <div ref={measureRootRef} className="rs-carousel-hero__text-measure" aria-hidden="true">
              {slides.map((slide, i) => (
                <HeroSlideMeasureCopy key={i} namespace={NS} slide={slide} titleHeadingLevel={titleHeadingLevel} />
              ))}
            </div>
            <div
              ref={textBlockRef}
              className="rs-carousel-hero__text-block rs-carousel-hero__text-block--swap"
              aria-live="polite"
            >
              {outgoingSlide ? (
                <div className="rs-carousel-hero__text-pane-outgoing" aria-hidden="true">
                  <div className="rs-carousel-hero__text-pane rs-carousel-hero__text-pane--exit-y">
                    <HeroSlideTextContent
                      namespace={NS}
                      title={outgoingSlide.title}
                      body={outgoingSlide.body}
                      titleHeadingLevel={titleHeadingLevel}
                    />
                  </div>
                </div>
              ) : null}
              <div ref={visibleTextBlockRef} className="rs-carousel-hero__text-pane-incoming">
                <div key={safeIndex} className={carouselTextPaneClass}>
                  <HeroSlideTextContent
                    namespace={NS}
                    title={current.title}
                    body={current.body}
                    titleHeadingLevel={titleHeadingLevel}
                  />
                </div>
              </div>
            </div>
          </div>

          {maxCtaCountAcrossSlides > 0 ? (
            <div
              className={[
                'rs-carousel-hero__cta-slot',
                tallestCtaRowPx != null ? 'rs-carousel-hero__cta-slot--locked' : '',
                'rs-carousel-hero__cta-slot--swap'
              ]
                .filter(Boolean)
                .join(' ')}
              style={tallestCtaRowPx != null ? { minHeight: tallestCtaRowPx } : undefined}
            >
              {outgoingSlide?.ctas?.length ? (
                <div className="rs-carousel-hero__cta-outgoing" aria-hidden="true">
                  <div className="rs-carousel-hero__cta-exit-wrap rs-carousel-hero__cta-row--exit-y">
                    <HeroSlideCtaRow namespace={NS} ctas={outgoingSlide.ctas} />
                  </div>
                </div>
              ) : null}
              <div ref={ctaSlotInnerRef} className="rs-carousel-hero__cta-slot-inner">
                {current.ctas?.length ? (
                  <div
                    key={safeIndex}
                    className={['rs-carousel-hero__cta-enter-wrap', ctaSwapEnterClass].filter(Boolean).join(' ')}
                  >
                    <HeroSlideCtaRow namespace={NS} ctas={current.ctas} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {slideCount >= 2 ? (
          <div
            className="rs-carousel-hero__actions"
            onPointerEnter={onCarouselChromePointerEnter}
            onPointerLeave={onCarouselChromePointerLeave}
            onFocus={onCarouselChromeFocus}
            onBlur={onCarouselChromeBlur}
          >
            <div className="rs-carousel-hero__carousel-bar">
              <Button
                variant="circle"
                shape="rounded"
                type="button"
                ariaLabel="Previous slide"
                icon={<ChevronLeft />}
                onClick={goPrev}
              />
              <div className="rs-carousel-hero__indicator-track" role="group" aria-label="Choose slide">
                {slides.map((_, i) => {
                  const isActive = i === safeIndex
                  return (
                    <div
                      key={i}
                      className={[
                        'rs-carousel-hero__indicator-wrap',
                        isActive ? 'rs-carousel-hero__indicator-wrap--active' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-current={isActive ? 'true' : undefined}
                      aria-label={
                        isActive ? `Slide ${i + 1} of ${slideCount} (current)` : undefined
                      }
                    >
                      {isActive && !reducedMotion ? (
                        <>
                          <span
                            key={`${safeIndex}-${timerToken}`}
                            className="rs-carousel-hero__indicator-progress"
                            aria-hidden
                          />
                          <button
                            type="button"
                            className="rs-carousel-hero__indicator-autoplay-toggle"
                            aria-pressed={!autoplayUserPaused}
                            aria-label={autoplayUserPaused ? 'Resume autoplay' : 'Pause autoplay'}
                            onClick={(e) => {
                              e.stopPropagation()
                              setAutoplayUserPaused((was) => {
                                if (was) restartAutoplay()
                                return !was
                              })
                            }}
                          >
                            {autoplayUserPaused ? <AutoplayPlayIcon /> : <AutoplayPauseIcon />}
                          </button>
                        </>
                      ) : null}
                      {!isActive ? (
                        <button
                          type="button"
                          aria-label={`Slide ${i + 1} of ${slideCount}`}
                          className="rs-carousel-hero__indicator"
                          onClick={() => goTo(i)}
                        />
                      ) : null}
                    </div>
                  )
                })}
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
        ) : null}
      </div>
    </section>
  )
}

export default CarouselHero
