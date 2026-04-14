import React, { useEffect, useRef } from 'react'
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
  const darkVideoRef = useRef<HTMLVideoElement | null>(null)
  const lightVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!videoSources) return

    const syncVideo = (el: HTMLVideoElement | null) => {
      if (!el) return
      if (!isActive) {
        el.pause()
        el.currentTime = 0
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
  }, [isActive, videoSources])

  return (
    <div
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
        mobileTabletUncroppedMaxScale != null
          ? ({
              ['--hero-image-mobile-uncropped-max-scale' as string]: String(
                mobileTabletUncroppedMaxScale
              )
            } as React.CSSProperties)
          : undefined
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
