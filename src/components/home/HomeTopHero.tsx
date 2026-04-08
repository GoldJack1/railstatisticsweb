import React, { useState, useEffect, useRef, useCallback } from 'react'
import Button from '../Button'
import { preventSingleWordWidow } from '../../utils/textWidow'
import './HomeTopHero.css'

const IOS_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.jw.railstatisticsandroid.beta&pli=1'
const TOP_HERO_IMAGE_DARK_DESKTOP_TABLET = '/images/home/hometophero-desktop-tablet-dark.png'
const TOP_HERO_IMAGE_DARK_MOBILE = '/images/home/hometophero-mobile-dark.png'
const TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET = '/images/home/hometophero-desktop-tablet-light.png'
const TOP_HERO_IMAGE_LIGHT_MOBILE = '/images/home/hometophero-mobile-light.png'
const MAX_SCROLL_SCALE_DELTA = 1
const MAX_SCROLL_PARALLAX_Y = 44
const MAX_POINTER_PARALLAX_X = 18
const MAX_POINTER_PARALLAX_Y = 12

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface HomeTopHeroProps {
  title?: string
  subtitle?: string
  ctaLabel?: string
  className?: string
}

const HomeTopHero: React.FC<HomeTopHeroProps> = ({
  title = 'The Ultimate Station Bashing App is Here!',
  subtitle = "Start building a map of where you've been, one station at a time.",
  ctaLabel = 'Download Now',
  className = ''
}) => {
  const heroRef = useRef<HTMLElement>(null)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [modalOpen, setModalOpen] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [imageScale, setImageScale] = useState(1)
  const [imageParallaxX, setImageParallaxX] = useState(0)
  const [imageParallaxY, setImageParallaxY] = useState(0)
  const [imageMotionParallaxY, setImageMotionParallaxY] = useState(0)
  const modalRef = useRef<HTMLDivElement>(null)

  const copyLink = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }, [])

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let rafId = 0

    const updateScale = () => {
      rafId = 0
      const heroEl = heroRef.current
      if (!heroEl) return

      const rect = heroEl.getBoundingClientRect()
      const progress = Math.min(1, Math.max(0, (-rect.top) / Math.max(rect.height, 1)))
      const nextScale = 1 + progress * MAX_SCROLL_SCALE_DELTA
      const nextParallaxY = progress * MAX_SCROLL_PARALLAX_Y
      setImageScale(nextScale)
      setImageParallaxY(nextParallaxY)
    }

    const requestUpdate = () => {
      if (rafId !== 0) return
      rafId = window.requestAnimationFrame(updateScale)
    }

    requestUpdate()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer:fine)').matches) return

    const heroEl = heroRef.current
    if (!heroEl) return

    const onMouseMove = (event: MouseEvent) => {
      const rect = heroEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const normX = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 2 - 1
      const normY = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 2 - 1

      setImageParallaxX(normX * MAX_POINTER_PARALLAX_X)
      setImageMotionParallaxY(normY * MAX_POINTER_PARALLAX_Y)
    }

    const onMouseLeave = () => {
      setImageParallaxX(0)
      setImageMotionParallaxY(0)
    }

    heroEl.addEventListener('mousemove', onMouseMove)
    heroEl.addEventListener('mouseleave', onMouseLeave)

    return () => {
      heroEl.removeEventListener('mousemove', onMouseMove)
      heroEl.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer:coarse)').matches) return
    if (!('DeviceOrientationEvent' in window)) return

    const OrientationCtor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return
      const x = clamp(event.gamma, -30, 30) / 30
      const y = clamp(event.beta, -30, 30) / 30
      setImageParallaxX(x * MAX_POINTER_PARALLAX_X * 0.8)
      setImageMotionParallaxY(y * MAX_POINTER_PARALLAX_Y * 0.8)
    }

    const attachOrientation = () => {
      window.addEventListener('deviceorientation', onOrientation)
    }

    if (typeof OrientationCtor.requestPermission === 'function') {
      const requestPermission = () => {
        void OrientationCtor.requestPermission?.()
          .then((state) => {
            if (state === 'granted') attachOrientation()
          })
          .catch(() => {})
      }

      window.addEventListener('touchstart', requestPermission, { once: true, passive: true })

      return () => {
        window.removeEventListener('touchstart', requestPermission)
        window.removeEventListener('deviceorientation', onOrientation)
      }
    }

    attachOrientation()
    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [])

  const handleCta = () => {
    if (platform === 'ios') {
      window.location.href = IOS_URL
    } else if (platform === 'android') {
      window.location.href = ANDROID_URL
    } else {
      setModalOpen(true)
    }
  }

  const getCopyIcon = (isCopied: boolean) => (
    <span className="rs-home-top-hero__copy-icon-stack" aria-hidden="true">
      <svg
        className={['rs-home-top-hero__copy-icon', !isCopied && 'is-visible'].filter(Boolean).join(' ')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <svg
        className={['rs-home-top-hero__copy-icon', isCopied && 'is-visible'].filter(Boolean).join(' ')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )

  return (
    <section
      ref={heroRef}
      className={['rs-home-top-hero', className].filter(Boolean).join(' ')}
      aria-label="Download Rail Statistics"
      style={
        {
          ['--hero-image-scale' as string]: imageScale,
          ['--hero-image-parallax-x' as string]: `${imageParallaxX}px`,
          ['--hero-image-parallax-y' as string]: `${imageParallaxY}px`,
          ['--hero-image-motion-y' as string]: `${imageMotionParallaxY}px`
        } as React.CSSProperties
      }
    >
      <div className="rs-home-top-hero__frame12">
        <div className="rs-home-top-hero__text-and-button">
          <div className="rs-home-top-hero__frame15">
            <h1 className="rs-home-top-hero__title">{title}</h1>
          </div>
          <div className="rs-home-top-hero__frame16">
            <p className="rs-home-top-hero__subtitle">{preventSingleWordWidow(subtitle)}</p>
          </div>
          <div className="rs-home-top-hero__frame14">
            <div className="rs-home-top-hero__cta-wrap">
              <Button
                variant="wide"
                shape="rounded"
                width="fill"
                colorVariant="accent"
                onClick={handleCta}
                className="rs-home-top-hero__cta"
              >
                {ctaLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="rs-home-top-hero__frame4" aria-hidden="true">
          {/* Dark mode image */}
          <picture className="rs-home-top-hero__picture rs-home-top-hero__picture--dark">
            <source media="(min-width: 640px)" srcSet={TOP_HERO_IMAGE_DARK_DESKTOP_TABLET} />
            <img className="rs-home-top-hero__image" src={TOP_HERO_IMAGE_DARK_MOBILE} alt="" loading="eager" decoding="async" />
          </picture>
          {/* Light mode image */}
          <picture className="rs-home-top-hero__picture rs-home-top-hero__picture--light">
            <source media="(min-width: 640px)" srcSet={TOP_HERO_IMAGE_LIGHT_DESKTOP_TABLET} />
            <img className="rs-home-top-hero__image" src={TOP_HERO_IMAGE_LIGHT_MOBILE} alt="" loading="eager" decoding="async" />
          </picture>
        </div>

        <div className="rs-home-top-hero__gradient-layer" aria-hidden="true" />
      </div>

      {modalOpen && (
        <div
          className="rs-home-top-hero__modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Download Rail Statistics"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="rs-home-top-hero__modal" ref={modalRef}>
            <button
              className="rs-home-top-hero__modal-close"
              aria-label="Close"
              onClick={() => setModalOpen(false)}
            >
              ✕
            </button>
            <h2 className="rs-home-top-hero__modal-title">Download Rail Statistics</h2>
            <p className="rs-home-top-hero__modal-subtitle">Choose your platform</p>
            <div className="rs-home-top-hero__modal-buttons">
              <div className="rs-home-top-hero__modal-row">
                <Button
                  variant="wide"
                  shape="rounded"
                  width="fill"
                  colorVariant="accent"
                  onClick={() => { window.location.href = IOS_URL }}
                >
                  Download on iOS
                </Button>
                <Button
                  variant="circle"
                  shape="rounded"
                  colorVariant="secondary"
                  ariaLabel="Copy iOS link"
                  onClick={() => copyLink(IOS_URL)}
                  icon={getCopyIcon(copiedUrl === IOS_URL)}
                />
              </div>
              <div className="rs-home-top-hero__modal-row">
                <Button
                  variant="wide"
                  shape="rounded"
                  width="fill"
                  colorVariant="accent"
                  onClick={() => { window.location.href = ANDROID_URL }}
                >
                  Download on Android
                </Button>
                <Button
                  variant="circle"
                  shape="rounded"
                  colorVariant="secondary"
                  ariaLabel="Copy Android link"
                  onClick={() => copyLink(ANDROID_URL)}
                  icon={getCopyIcon(copiedUrl === ANDROID_URL)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default HomeTopHero
