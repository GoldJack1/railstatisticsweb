/**
 * Single-slide hero: same full-bleed layout and image stack as `CarouselHero`, without strip, autoplay, or controls.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Button from '../Button'
import HomeTopHeroImageStack, { type HomeTopHeroImageStackSources } from './HomeTopHeroImageStack'
import { DEFAULT_HERO_STACK_IMAGE_SOURCES } from './homeTopHeroImageConstants'
import { useHomeTopHeroImageMotion } from './useHomeTopHeroImageMotion'
import {
  mergeCarouselHeroSlideSources,
  type CarouselHeroContentFill,
  type CarouselHeroSlide,
  type CarouselHeroSlideCta
} from './heroCarouselSlideModel'
import './StaticHero.css'

export type StaticHeroSlide = CarouselHeroSlide

/** Desktop (≥1200px): vertical placement of the text + CTA column inside the content panel. */
export type StaticHeroDesktopContentVerticalAlign = 'bottom' | 'top' | 'center'

/** `hero` (default): carousel-style title/body sizes. `splash`: wide desktop matches HomeTopHero title/subtitle scale (see CSS). */
export type StaticHeroTextStyle = 'hero' | 'splash'

const TEXT_SHELL_HEIGHT_BUFFER_PX = 6
const CTA_SLOT_HEIGHT_BUFFER_PX = 4
const LOCKED_TEXT_BLOCK_SCROLL_CLASS = 'rs-static-hero__text-block--scroll-y'

function measureBlockHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect().height
  return Math.max(el.offsetHeight, el.scrollHeight, rect)
}

export interface StaticHeroProps {
  slide: StaticHeroSlide
  /** Defaults merged into `slide.imageSources` (partials override). */
  defaultImageSources?: HomeTopHeroImageStackSources
  className?: string
  /** `aria-label` on the region (default: Featured). */
  ariaLabel?: string
  /**
   * `bgSecondary` (default): gradient solid uses `var(--bg-secondary)`.
   * `heroTint`: solid matches the hometophero band (`hsl(0 100% 92%)` / dark `hsl(0 100% 8%)`).
   */
  contentFill?: CarouselHeroContentFill
  /**
   * Wide desktop only: align the copy + CTA stack within the left content column.
   * `bottom` (default) matches the carousel hero (content toward the lower area).
   */
  desktopContentVerticalAlign?: StaticHeroDesktopContentVerticalAlign
  /**
   * Typography scale: `splash` uses HomeTopHero-sized copy on desktop only (≥1200px).
   * On desktop, splash also **vertically centers** the copy + CTA block; set `desktopContentVerticalAlign="top"` to pin it to the top instead.
   */
  textStyle?: StaticHeroTextStyle
}

const HeroSlideCtaRow: React.FC<{ ctas?: CarouselHeroSlideCta[] }> = ({ ctas }) => {
  if (!ctas?.length) return null
  const multi = ctas.length > 1
  return (
    <div
      className={[
        'rs-static-hero__slide-ctas',
        multi ? 'rs-static-hero__slide-ctas--multi' : 'rs-static-hero__slide-ctas--single'
      ].join(' ')}
    >
      <div className="rs-static-hero__slide-ctas-inner">
        {ctas.map((cta, i) => (
          <div key={i} className="rs-static-hero__slide-cta-wrap">
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

const HeroSlideTextContent: React.FC<{ title: string; body: React.ReactNode }> = ({ title, body }) => (
  <>
    <div className="rs-static-hero__title-wrap">
      <h2 className="rs-static-hero__title">{title}</h2>
    </div>
    <div className="rs-static-hero__body">{body}</div>
  </>
)

const HeroSlideMeasureCopy: React.FC<{ slide: Pick<CarouselHeroSlide, 'title' | 'body'> }> = ({ slide }) => (
  <div className="rs-static-hero__text-measure-item">
    <HeroSlideTextContent title={slide.title} body={slide.body} />
  </div>
)

const StaticHero: React.FC<StaticHeroProps> = ({
  slide,
  defaultImageSources = DEFAULT_HERO_STACK_IMAGE_SOURCES,
  className = '',
  ariaLabel = 'Featured',
  contentFill = 'bgSecondary',
  desktopContentVerticalAlign = 'bottom',
  textStyle = 'hero'
}) => {
  const staticSectionRef = useRef<HTMLElement | null>(null)
  useHomeTopHeroImageMotion(staticSectionRef, true)

  const textShellRef = useRef<HTMLDivElement>(null)
  const textBlockRef = useRef<HTMLDivElement>(null)
  const measureRootRef = useRef<HTMLDivElement>(null)
  const visibleTextBlockRef = useRef<HTMLDivElement>(null)
  const ctaMeasureRootRef = useRef<HTMLDivElement>(null)
  const ctaSlotInnerRef = useRef<HTMLDivElement>(null)

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

  useLayoutEffect(() => {
    const block = textBlockRef.current
    if (!block) return
    if (tallestSlideTextPx == null) {
      block.classList.remove(LOCKED_TEXT_BLOCK_SCROLL_CLASS)
      return
    }
    const sync = () => {
      const el = textBlockRef.current
      if (!el) return
      const needsScroll = el.scrollHeight > el.clientHeight + 2
      el.classList.toggle(LOCKED_TEXT_BLOCK_SCROLL_CLASS, needsScroll)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(block)
    return () => {
      ro.disconnect()
      block.classList.remove(LOCKED_TEXT_BLOCK_SCROLL_CLASS)
    }
  }, [tallestSlideTextPx, slide.title, slide.body, textStyle])

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
      aria-label={ariaLabel}
    >
      <div className="rs-static-hero__visual" aria-hidden="true">
        <div className="rs-static-hero__visual-inner">
          <HomeTopHeroImageStack
            variant="staticHero"
            loading="lazy"
            sources={mergeCarouselHeroSlideSources(slide, defaultImageSources)}
            alt={slide.imageAlt ?? ''}
          />
        </div>
      </div>

      <div className="rs-static-hero__content">
        {slide.ctas?.length ? (
          <div ref={ctaMeasureRootRef} className="rs-static-hero__cta-measure" aria-hidden="true">
            <div className="rs-static-hero__cta-measure-item">
              <HeroSlideCtaRow ctas={slide.ctas} />
            </div>
          </div>
        ) : null}

        <div className="rs-static-hero__copy-stack">
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
              <HeroSlideMeasureCopy slide={slide} />
            </div>
            <div ref={textBlockRef} className="rs-static-hero__text-block">
              <div ref={visibleTextBlockRef} className="rs-static-hero__text-pane-incoming">
                <div className="rs-static-hero__text-pane">
                  <HeroSlideTextContent title={slide.title} body={slide.body} />
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
                  <HeroSlideCtaRow ctas={slide.ctas} />
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
