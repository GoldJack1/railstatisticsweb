import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export type ScrollDirectionFadeOptions = {
  /**
   * Fade in once the block’s top is above this fraction of the viewport height from the top
   * (0 = top, 1 = bottom). Higher = less scroll before reveal. Default `0.72`.
   */
  revealLine?: number
  /**
   * Minimum fraction of the measured rect’s height that must intersect the viewport before fade-in.
   * Default `0.2`; `minVisibleFractionMobile` when `mobileMediaQuery` matches.
   */
  minVisibleFraction?: number
  minVisibleFractionMobile?: number
  mobileMediaQuery?: string
}

export function unionDOMRects(a: DOMRect, b: DOMRect): DOMRect {
  const left = Math.min(a.left, b.left)
  const top = Math.min(a.top, b.top)
  const right = Math.max(a.right, b.right)
  const bottom = Math.max(a.bottom, b.bottom)
  return new DOMRect(left, top, right - left, bottom - top)
}

function visibleHeightInViewport(rect: DOMRect, vh: number): number {
  const top = Math.max(rect.top, 0)
  const bottom = Math.min(rect.bottom, vh)
  return Math.max(0, bottom - top)
}

/** 0–1: how much of the rect’s height is visible in the viewport (vertical only). */
export function visibleFractionInViewport(rect: DOMRect, vh: number): number {
  if (rect.height <= 0) return 0
  return Math.min(1, visibleHeightInViewport(rect, vh) / rect.height)
}

function useScrollDirectionFadeCore(
  getRect: () => DOMRect | null,
  layoutBust: unknown,
  options?: ScrollDirectionFadeOptions
): boolean {
  const reducedMotion = usePrefersReducedMotion()
  const [visible, setVisible] = useState(false)
  const revealLine = options?.revealLine ?? 0.72
  const minVisibleFraction = options?.minVisibleFraction ?? 0.2
  const minVisibleFractionMobile = options?.minVisibleFractionMobile ?? 0.1
  const mobileMediaQuery = options?.mobileMediaQuery ?? '(max-width: 767px)'

  useLayoutEffect(() => {
    if (reducedMotion) {
      setVisible(true)
      return
    }

    const minFracForViewport = () => {
      if (typeof window === 'undefined' || !window.matchMedia) return minVisibleFraction
      return window.matchMedia(mobileMediaQuery).matches ? minVisibleFractionMobile : minVisibleFraction
    }

    const tryReveal = (rect: DOMRect) => {
      const vh = window.innerHeight
      const reveal = vh * revealLine
      const frac = visibleFractionInViewport(rect, vh)
      const minFrac = minFracForViewport()
      if (frac >= minFrac && rect.top < reveal && rect.bottom > vh * 0.04) {
        setVisible(true)
      }
    }

    const measureInitial = () => {
      const rect = getRect()
      if (!rect) return
      const vh = window.innerHeight
      const frac = visibleFractionInViewport(rect, vh)
      const minFrac = minFracForViewport()
      if (rect.top < vh * 0.98 && rect.bottom > vh * 0.02 && frac >= minFrac) {
        setVisible(true)
      }
    }

    const syncLayout = () => {
      const rect = getRect()
      if (!rect) return
      const vh = window.innerHeight
      const frac = visibleFractionInViewport(rect, vh)
      const minFrac = minFracForViewport()
      if (frac < minFrac) {
        setVisible(false)
        return
      }
      tryReveal(rect)
    }

    measureInitial()

    let raf = 0
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        const rect = getRect()
        if (!rect) return
        tryReveal(rect)
      })
    }

    const onResize = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        syncLayout()
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [
    reducedMotion,
    revealLine,
    getRect,
    layoutBust,
    minVisibleFraction,
    minVisibleFractionMobile,
    mobileMediaQuery
  ])

  return reducedMotion || visible
}

export function useScrollDirectionFadeBounds(
  getBounds: () => DOMRect | null,
  layoutBust: unknown,
  options?: ScrollDirectionFadeOptions
): boolean {
  return useScrollDirectionFadeCore(getBounds, layoutBust, options)
}

export function useScrollDirectionFade(
  elementRef: RefObject<HTMLElement | null>,
  options?: ScrollDirectionFadeOptions
): boolean {
  const getRect = useCallback(() => elementRef.current?.getBoundingClientRect() ?? null, [elementRef])
  return useScrollDirectionFadeCore(getRect, null, options)
}
