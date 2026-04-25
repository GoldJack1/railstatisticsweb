import React, { useCallback, useEffect, useState } from 'react'
import { BUTBaseButton as Button } from '../../buttons'
import { BUTSharedNativeButton } from '../../buttons'
import './HomeDownloadPlatformModal.css'

const IOS_URL = 'https://apps.apple.com/gb/app/rail-statistics/id6759503043'
const ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.jw.railstatisticsandroid.beta&pli=1'

export interface HomeDownloadPlatformModalProps {
  open: boolean
  onClose: () => void
}

const getCopyIcon = (isCopied: boolean) => (
  <span className="rs-download-platform-modal__copy-icon-stack" aria-hidden="true">
    <svg
      className={['rs-download-platform-modal__copy-icon', !isCopied && 'is-visible'].filter(Boolean).join(' ')}
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
      className={['rs-download-platform-modal__copy-icon', isCopied && 'is-visible'].filter(Boolean).join(' ')}
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

/** Desktop “choose platform” dialog for the home download CTA. */
const HomeDownloadPlatformModal: React.FC<HomeDownloadPlatformModalProps> = ({ open, onClose }) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const copyLink = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="rs-download-platform-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Download Rail Statistics"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="rs-download-platform-modal">
        <BUTSharedNativeButton type="button" className="rs-download-platform-modal__close" aria-label="Close" onClick={onClose}>
          ✕
        </BUTSharedNativeButton>
        <h2 className="rs-download-platform-modal__title">Download Rail Statistics</h2>
        <p className="rs-download-platform-modal__subtitle">Choose your platform</p>
        <div className="rs-download-platform-modal__buttons">
          <div className="rs-download-platform-modal__row">
            <Button
              variant="wide"
              shape="rounded"
              width="fill"
              colorVariant="accent"
              type="button"
              onClick={() => {
                window.location.href = IOS_URL
              }}
            >
              Download on iOS
            </Button>
            <Button
              variant="circle"
              shape="rounded"
              type="button"
              colorVariant="secondary"
              ariaLabel="Copy iOS link"
              onClick={() => copyLink(IOS_URL)}
              icon={getCopyIcon(copiedUrl === IOS_URL)}
            />
          </div>
          <div className="rs-download-platform-modal__row">
            <Button
              variant="wide"
              shape="rounded"
              width="fill"
              colorVariant="accent"
              type="button"
              onClick={() => {
                window.location.href = ANDROID_URL
              }}
            >
              Download on Android
            </Button>
            <Button
              variant="circle"
              shape="rounded"
              type="button"
              colorVariant="secondary"
              ariaLabel="Copy Android link"
              onClick={() => copyLink(ANDROID_URL)}
              icon={getCopyIcon(copiedUrl === ANDROID_URL)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeDownloadPlatformModal
