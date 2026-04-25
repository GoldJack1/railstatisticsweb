/**
 * Single-slide hero: same full-bleed layout and image stack as `CarouselHero`, without strip, autoplay, or controls.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HeroImageStack, type HeroImageStackSources, type HeroMobileTabletUncroppedSettings } from '../index'
import { DEFAULT_HERO_STACK_IMAGE_SOURCES } from '../heroImageConstants'
import {
  HeroSlideCtaRow,
  HeroSlideMeasureCopy,
  HeroSlideTextContent,
  type HeroTitleHeadingLevel
} from '../HeroSlideCopy'
import {
  mergeCarouselHeroSlideSources,
  type CarouselHeroContentFill,
  type CarouselHeroSlide,
  type HeroDesktopPanelSide,
  type HeroMediaCropMode,
  type HeroMobilePanelPosition,
  type HeroTextStyle
} from '../../models/heroCarouselSlideModel'
import { heroCopySlideCssVarProperties } from '../heroSlideAnimationTokens'
import {
  CTA_SLOT_HEIGHT_BUFFER_PX,
  measureBlockHeight,
  scheduleDoubleRaf,
  TEXT_SHELL_HEIGHT_BUFFER_PX
} from '../heroMeasure'
import { unionDOMRects, useScrollDirectionFadeBounds } from '../../../hooks/useScrollDirectionFade'
import { scrollFadeRevealClassNames } from '../../misc/ScrollFadeReveal/ScrollFadeReveal'
import '../../misc/ScrollFadeReveal/ScrollFadeReveal.css'
import { useHeroImageMotion } from '../useHeroImageMotion'
import { useLockedHeroTextBlockScroll } from '../useLockedHeroTextBlockScroll'
import './StaticHero.css'

export type StaticHeroSlide = CarouselHeroSlide

/** @deprecated Use `HeroTextStyle` from `heroCarouselSlideModel` — same union. */
export type StaticHeroTextStyle = HeroTextStyle

/** Desktop (≥1200px): vertical placement of the text + CTA column inside the content panel. */
export type StaticHeroDesktopContentVerticalAlign = 'bottom' | 'top' | 'center'

const NS = 'static' as const
const LOCKED_TEXT_BLOCK_SCROLL_CLASS = 'rs-static-hero__text-block--scroll-y'

export interface StaticHeroProps {
  slide: StaticHeroSlide
  /** Defaults merged into `slide.imageSources` (partials override). */
  defaultImageSources?: HeroImageStackSources
  /**
   * Hero image `loading` hint. Defaults to `eager`.
   */
  imageLoading?: 'eager' | 'lazy'
  className?: string
  /** `aria-label` on the region (default: Featured). */
  ariaLabel?: string
  /**
   * `bgSecondary` (default): gradient solid uses `var(--bg-secondary)`.
   * `heroTint`: solid matches the hero band (`hsl(354 100% 85%)` / dark `hsl(0 100% 8%)`).
   */
  contentFill?: CarouselHeroContentFill
  /**
   * Wide desktop only: align the copy + CTA stack within the left content column.
   * `bottom` (default) matches the carousel hero (content toward the lower area).
   */
  desktopContentVerticalAlign?: StaticHeroDesktopContentVerticalAlign
  /**
   * Typography scale: `splash` uses large splash copy on desktop only (≥1200px).
   * On desktop, splash also **vertically centers** the copy + CTA block; set `desktopContentVerticalAlign="top"` to pin it to the top instead.
   */
  textStyle?: HeroTextStyle
  /** Semantic level for the visible title (default `2` for a typical section hero). */
  titleHeadingLevel?: HeroTitleHeadingLevel
  /** ≥1200px: copy panel on the start half (left in LTR) or end half (right). */
  desktopPanelSide?: HeroDesktopPanelSide
  /** Below 1200px: stack copy toward the bottom (default) or top of the hero band. */
  mobilePanelPosition?: HeroMobilePanelPosition
  /** Mobile/tablet media framing default for this static hero. */
  mobileTabletMediaMode?: HeroMediaCropMode
  /** Optional default max scale cap for mobile/tablet uncropped media. */
  mobileTabletUncroppedMaxScale?: number
  /** Optional default uncropped tuning for mobile/tablet media. */
  mobileTabletUncroppedSettings?: HeroMobileTabletUncroppedSettings
}

const StaticHero: React.FC<StaticHeroProps> = ({
  slide,
  defaultImageSources = DEFAULT_HERO_STACK_IMAGE_SOURCES,
  imageLoading = 'eager',
  className = '',
  ariaLabel = 'Featured',
  contentFill = 'bgSecondary',
  desktopContentVerticalAlign = 'bottom',
  textStyle = 'hero',
  titleHeadingLevel = 2,
  desktopPanelSide = 'left',
  mobilePanelPosition = 'bottom',
  mobileTabletMediaMode = 'cropped',
  mobileTabletUncroppedMaxScale,
  mobileTabletUncroppedSettings
}) => {
  const staticSectionRef = useRef<HTMLElement | null>(null)

  const textShellRef = useRef<HTMLDivElement>(null)
  const textBlockRef = useRef<HTMLDivElement>(null)
  const measureRootRef = useRef<HTMLDivElement>(null)
  const visibleTextBlockRef = useRef<HTMLDivElement>(null)
  const ctaMeasureRootRef = useRef<HTMLDivElement>(null)
  const ctaSlotInnerRef = useRef<HTMLDivElement>(null)
  const scrollFadeVisualRef = useRef<HTMLDivElement>(null)
  const scrollFadeCopyRef = useRef<HTMLDivElement>(null)

  const [tallestSlideTextPx, setTallestSlideTextPx] = useState<number | undefined>(undefined)
  const [tallestCtaRowPx, setTallestCtaRowPx] = useState<number | undefined>(undefined)

  const maxCtaCount = slide.ctas?.length ?? 0
  const staticHeroCtaBand: '0' | '1' | '2' =
    maxCtaCount >= 2 ? '2' : maxCtaCount === 1 ? '1' : '0'

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
    if (maxCtaCount === 0) {
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
    const live = ctaSlotInnerRef.current
    const liveRow = live?.firstElementChild
    if (liveRow instanceof HTMLElement) {
      max = Math.max(max, measureBlockHeight(liveRow))
    }
    if (max <= 0) return
    setTallestCtaRowPx(Math.ceil(max) + CTA_SLOT_HEIGHT_BUFFER_PX)
  }, [maxCtaCount])

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
  }, [scheduleMeasure, slide.title, slide.body, textStyle])

  useLayoutEffect(() => {
    if (maxCtaCount === 0) return
    const el = ctaMeasureRootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      scheduleMeasure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxCtaCount, scheduleMeasure, slide.ctas?.length])

  useLayoutEffect(() => {
    measureTallestSlideText()
    measureTallestCtaRow()
  }, [slide.title, slide.body, slide.ctas?.length, textStyle, measureTallestSlideText, measureTallestCtaRow])

  const textBlockScrollLayoutKey = `${tallestSlideTextPx ?? ''}|${slide.title}|${textStyle}|${titleHeadingLevel}`
  useLockedHeroTextBlockScroll(
    textBlockRef,
    tallestSlideTextPx != null,
    LOCKED_TEXT_BLOCK_SCROLL_CLASS,
    textBlockScrollLayoutKey
  )

  useHeroImageMotion(staticSectionRef, true, {
    ancestorScrollRoots: [textBlockRef],
    ancestorScrollResyncKey: textBlockScrollLayoutKey
  })

  const getScrollFadeUnionBounds = useCallback((): DOMRect | null => {
    const a = scrollFadeVisualRef.current?.getBoundingClientRect() ?? null
    const b = scrollFadeCopyRef.current?.getBoundingClientRect() ?? null
    if (a && b) return unionDOMRects(a, b)
    return a ?? b
  }, [])

  const scrollFadeLayoutBust = `${slide.title}|${tallestSlideTextPx ?? ''}|${tallestCtaRowPx ?? ''}|${textStyle}|${maxCtaCount}`

  const scrollFadeVisible = useScrollDirectionFadeBounds(getScrollFadeUnionBounds, scrollFadeLayoutBust)

  useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) scheduleMeasure()
    })
    return () => {
      cancelled = true
    }
  }, [scheduleMeasure, slide.title, textStyle])

  return (
    <section
      ref={staticSectionRef}
      className={[
        'rs-static-hero',
        contentFill === 'heroTint' ? 'rs-static-hero--content-fill-hero-tint' : '',
        textStyle === 'splash' ? 'rs-static-hero--text-splash' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      data-static-hero-cta-band={staticHeroCtaBand}
      data-static-hero-desktop-valign={desktopContentVerticalAlign}
      data-hero-desktop-panel={desktopPanelSide === 'right' ? 'right' : undefined}
      data-hero-mobile-panel={mobilePanelPosition === 'top' ? 'top' : undefined}
      aria-label={ariaLabel}
      style={heroCopySlideCssVarProperties('static')}
    >
      <div className="rs-static-hero__visual" aria-hidden="true">
        <div
          ref={scrollFadeVisualRef}
          className={`rs-static-hero__visual-inner ${scrollFadeRevealClassNames(scrollFadeVisible)}`}
        >
          <HeroImageStack
            variant="static"
            loading={imageLoading}
            sources={mergeCarouselHeroSlideSources(slide, defaultImageSources)}
            videoSources={slide.videoSources}
            videoLoop={Boolean(slide.videoSources)}
            mobileTabletMediaMode={slide.mobileTabletMediaMode ?? mobileTabletMediaMode}
            mobileTabletUncroppedMaxScale={
              slide.mobileTabletUncroppedMaxScale ?? mobileTabletUncroppedMaxScale
            }
            mobileTabletUncroppedSettings={
              slide.mobileTabletUncroppedSettings ?? mobileTabletUncroppedSettings
            }
            alt={slide.imageAlt ?? ''}
          />
        </div>
      </div>

      <div className="rs-static-hero__content">
        {slide.ctas?.length ? (
          <div ref={ctaMeasureRootRef} className="rs-static-hero__cta-measure" aria-hidden="true">
            <div className="rs-static-hero__cta-measure-item">
              <HeroSlideCtaRow namespace={NS} ctas={slide.ctas} />
            </div>
          </div>
        ) : null}

        <div
          ref={scrollFadeCopyRef}
          className={`rs-static-hero__copy-stack ${scrollFadeRevealClassNames(scrollFadeVisible)}`}
        >
          <div
            ref={textShellRef}
            className={[
              'rs-static-hero__text-shell',
              tallestSlideTextPx != null ? 'rs-static-hero__text-shell--locked' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              tallestSlideTextPx != null
                ? { minHeight: tallestSlideTextPx, height: tallestSlideTextPx }
                : undefined
            }
          >
            <div ref={measureRootRef} className="rs-static-hero__text-measure" aria-hidden="true">
              <HeroSlideMeasureCopy namespace={NS} slide={slide} titleHeadingLevel={titleHeadingLevel} />
            </div>
            <div ref={textBlockRef} className="rs-static-hero__text-block">
              <div ref={visibleTextBlockRef} className="rs-static-hero__text-pane-incoming">
                <div className="rs-static-hero__text-pane">
                  <HeroSlideTextContent
                    namespace={NS}
                    title={slide.title}
                    body={slide.body}
                    titleHeadingLevel={titleHeadingLevel}
                  />
                </div>
              </div>
            </div>
          </div>

          {slide.ctas?.length ? (
            <div
              className={[
                'rs-static-hero__cta-slot',
                tallestCtaRowPx != null ? 'rs-static-hero__cta-slot--locked' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              style={tallestCtaRowPx != null ? { minHeight: tallestCtaRowPx } : undefined}
            >
              <div ref={ctaSlotInnerRef} className="rs-static-hero__cta-slot-inner">
                <div className="rs-static-hero__cta-enter-wrap">
                  <HeroSlideCtaRow namespace={NS} ctas={slide.ctas} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default StaticHero
