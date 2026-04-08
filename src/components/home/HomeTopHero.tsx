import React, { useState, useEffect, useRef, useCallback } from 'react'
import Button from '../Button'
import { preventSingleWordWidow } from '../../utils/textWidow'
import './HomeTopHero.css'

const IOS_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.jw.railstatisticsandroid.beta&pli=1'
const DEFAULT_IMAGE_URL_DARK = '/images/home/newherotopdark.png'
const DEFAULT_IMAGE_URL_LIGHT = '/images/home/newherotoplight.png'

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
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
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [modalOpen, setModalOpen] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
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
      className={['rs-home-top-hero', className].filter(Boolean).join(' ')}
      aria-label="Download Rail Statistics"
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
            <img className="rs-home-top-hero__image" src={DEFAULT_IMAGE_URL_DARK} alt="" loading="eager" decoding="async" />
          </picture>
          {/* Light mode image */}
          <picture className="rs-home-top-hero__picture rs-home-top-hero__picture--light">
            <img className="rs-home-top-hero__image" src={DEFAULT_IMAGE_URL_LIGHT} alt="" loading="eager" decoding="async" />
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
