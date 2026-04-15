import React, { useEffect, useRef, useState } from 'react'
import {
  HERO_IMAGE_DARK_DESKTOP_TABLET,
  HERO_IMAGE_DARK_MOBILE,
  HERO_IMAGE_LIGHT_DESKTOP_TABLET,
  HERO_IMAGE_LIGHT_MOBILE
} from './heroImageConstants'
import './HeroImageStack.css'

export type HeroImageStackVariant = 'carousel' | 'static'

/** Overrides default hero art URLs (per-slide carousel art, tests, etc.). */
export interface HeroImageStackSources {
  darkDesktopTablet: string
  darkMobile: string
  lightDesktopTablet: string
  lightMobile: string
}

export interface HeroMobileTabletUncroppedSettings {
  /** Multiplies mobile/tablet uncropped scale response speed. */
  scaleSpeed?: number
  /** Caps mobile/tablet uncropped scale. */
  maxScale?: number
  /** Media width while uncropped on mobile/tablet. */
  mediaWidthPercent?: number
  /** Top offset for uncropped images on mobile/tablet. */
  imageTopPercent?: number
  /** Top offset for uncropped videos on mobile/tablet. */
  videoTopPercent?: number
  /** Shared top offset on tablet-sized uncropped viewports. */
  tabletTopPercent?: number
}

export interface HeroImageStackProps {
  variant: HeroImageStackVariant
  /** `eager` for above-the-fold primary hero; `lazy` for lower sections. */
  loading?: 'eager' | 'lazy'
  /** When set, replaces built-in paths (e.g. merged per-slide sources). */
  sources?: HeroImageStackSources
  /** Optional themed videos. When present, videos render instead of image sources. */
  videoSources?: {
    dark: string
    light: string
    darkMobileTablet?: string
  }
  /** Mobile/tablet media framing mode. */
  mobileTabletMediaMode?: 'cropped' | 'uncropped'
  /** Optional uncropped tuning for this specific usage. */
  mobileTabletUncroppedSettings?: HeroMobileTabletUncroppedSettings
  /** Optional max scale cap for mobile/tablet uncropped mode. */
  mobileTabletUncroppedMaxScale?: number
  /** Active carousel cell should be true so videos only play when visible. */
  isActive?: boolean
  /** When true, rendered videos loop. */
  videoLoop?: boolean
  /** Optional `img` alt when art is meaningful; empty for decorative. */
  alt?: string
}

const DESKTOP_PICTURE_MEDIA = '(min-width: 1200px)'

const VARIANT_MODIFIER: Record<HeroImageStackVariant, string> = {
  carousel: 'rs-home-hero-image-stack--carousel-hero',
  static: 'rs-home-hero-image-stack--static-hero'
}

const HeroImageStack: React.FC<HeroImageStackProps> = ({
  variant,
  loading = 'eager',
  sources,
  videoSources,
  mobileTabletMediaMode = 'cropped',
  mobileTabletUncroppedSettings,
  mobileTabletUncroppedMaxScale,
  isActive = true,
  videoLoop = false,
  alt = ''
}) => {
  const darkDesktopTablet = sources?.darkDesktopTablet ?? HERO_IMAGE_DARK_DESKTOP_TABLET
  const darkMobile = sources?.darkMobile ?? HERO_IMAGE_DARK_MOBILE
  const lightDesktopTablet = sources?.lightDesktopTablet ?? HERO_IMAGE_LIGHT_DESKTOP_TABLET
  const lightMobile = sources?.lightMobile ?? HERO_IMAGE_LIGHT_MOBILE
  const decorative = alt.trim() === ''
  const rootRef = useRef<HTMLDivElement | null>(null)
  const darkVideoRef = useRef<HTMLVideoElement | null>(null)
  const lightVideoRef = useRef<HTMLVideoElement | null>(null)
  const [isInViewport, setIsInViewport] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsInViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting)
      },
      { threshold: 0.2 }
    )

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!videoSources) return

    const syncVideo = (el: HTMLVideoElement | null) => {
      if (!el) return
      if (!isActive) {
        el.pause()
        el.currentTime = 0
        return
      }
      if (!isInViewport) {
        el.pause()
        return
      }
      if (el.ended) {
        return
      }
      void el.play().catch(() => {
        // Ignore failed autoplay attempts; muted inline videos should usually play.
      })
    }

    syncVideo(darkVideoRef.current)
    syncVideo(lightVideoRef.current)
  }, [isActive, isInViewport, videoSources])

  return (
    <div
      ref={rootRef}
      className={[
        'rs-home-hero-image-stack',
        VARIANT_MODIFIER[variant],
        mobileTabletMediaMode === 'uncropped'
          ? 'rs-home-hero-image-stack--mobile-tablet-uncropped'
          : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        ({
          ...(mobileTabletUncroppedSettings?.scaleSpeed != null
            ? {
                ['--hero-image-mobile-uncropped-scale-speed' as string]: String(
                  mobileTabletUncroppedSettings.scaleSpeed
                )
              }
            : {}),
          ...((mobileTabletUncroppedSettings?.maxScale ?? mobileTabletUncroppedMaxScale) != null
            ? {
                ['--hero-image-mobile-uncropped-max-scale' as string]: String(
                  mobileTabletUncroppedSettings?.maxScale ?? mobileTabletUncroppedMaxScale
                )
              }
            : {}),
          ...(mobileTabletUncroppedSettings?.mediaWidthPercent != null
            ? {
                ['--hero-image-mobile-uncropped-media-width' as string]: `${mobileTabletUncroppedSettings.mediaWidthPercent}%`
              }
            : {}),
          ...(mobileTabletUncroppedSettings?.imageTopPercent != null
            ? {
                ['--hero-image-mobile-uncropped-image-top' as string]: `${mobileTabletUncroppedSettings.imageTopPercent}%`
              }
            : {}),
          ...(mobileTabletUncroppedSettings?.videoTopPercent != null
            ? {
                ['--hero-image-mobile-uncropped-video-top' as string]: `${mobileTabletUncroppedSettings.videoTopPercent}%`
              }
            : {}),
          ...(mobileTabletUncroppedSettings?.tabletTopPercent != null
            ? {
                ['--hero-image-mobile-uncropped-tablet-top' as string]: `${mobileTabletUncroppedSettings.tabletTopPercent}%`
              }
            : {})
        } as React.CSSProperties)
      }
      aria-hidden={decorative ? true : undefined}
    >
      <div className="rs-home-hero-image-stack__frame">
        {videoSources ? (
          <>
            <div className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--dark">
              <video
                ref={darkVideoRef}
                className="rs-home-hero-image-stack__media"
                muted
                playsInline
                loop={videoLoop}
                preload="metadata"
                aria-hidden={decorative ? true : undefined}
              >
                {videoSources.darkMobileTablet ? (
                  <source media="(max-width: 1199px)" src={videoSources.darkMobileTablet} />
                ) : null}
                <source src={videoSources.dark} />
              </video>
            </div>
            <div className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--light">
              <video
                ref={lightVideoRef}
                className="rs-home-hero-image-stack__media"
                muted
                playsInline
                loop={videoLoop}
                preload="metadata"
                aria-hidden={decorative ? true : undefined}
              >
                <source src={videoSources.light} />
              </video>
            </div>
          </>
        ) : (
          <>
            <picture className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--dark">
              <source media={DESKTOP_PICTURE_MEDIA} srcSet={darkDesktopTablet} />
              <img
                className="rs-home-hero-image-stack__media"
                src={darkMobile}
                alt={alt}
                loading={loading}
                decoding="async"
              />
            </picture>
            <picture className="rs-home-hero-image-stack__picture rs-home-hero-image-stack__picture--light">
              <source media={DESKTOP_PICTURE_MEDIA} srcSet={lightDesktopTablet} />
              <img
                className="rs-home-hero-image-stack__media"
                src={lightMobile}
                alt={alt}
                loading={loading}
                decoding="async"
              />
            </picture>
          </>
        )}
      </div>
    </div>
  )
}

export default HeroImageStack
