import { type RefObject, useEffect } from 'react'

/**
 * As the hero’s top edge moves above the viewport, progress runs 0→1 over one hero-height of scroll;
 * scale becomes `1 + progress * MAX_SCROLL_SCALE_DELTA`, then multiplied by `NARROW_VIEWPORT_IMAGE_SCALE`
 * when `max-width: 409px` so the art reads smaller on very narrow phones.
 */
const MAX_SCROLL_SCALE_DELTA = 1
/** Must match hero CSS `@media (max-width: 409px)` — scales `--hero-image-scale` for both scroll motion and static fallback. */
const NARROW_VIEWPORT_IMAGE_SCALE = 0.75
const NARROW_VIEWPORT_MQ = '(max-width: 409px)'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Drives `--hero-image-scale` on the hero section from window scroll so the art subtly scales up as the user
 * scrolls down through the viewport. Respects `prefers-reduced-motion`.
 *
 * @param active When false, skips setup (e.g. hero not mounted yet).
 */
export function useHeroImageMotion(heroRef: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    if (!active) return
    const el = heroRef.current
    if (!el) return

    let raf = 0
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const narrowMq = window.matchMedia(NARROW_VIEWPORT_MQ)

    const apply = () => {
      raf = 0
      if (mq.matches) {
        el.style.removeProperty('--hero-image-scale')
        return
      }

      const rect = el.getBoundingClientRect()
      const progress = clamp((-rect.top) / Math.max(rect.height, 1), 0, 1)
      const base = 1 + progress * MAX_SCROLL_SCALE_DELTA
      const narrow = narrowMq.matches ? NARROW_VIEWPORT_IMAGE_SCALE : 1
      const scale = base * narrow
      el.style.setProperty('--hero-image-scale', scale.toFixed(4))
    }

    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    const onMq = () => apply()
    mq.addEventListener('change', onMq)
    narrowMq.addEventListener('change', onMq)

    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      mq.removeEventListener('change', onMq)
      narrowMq.removeEventListener('change', onMq)
      if (raf) cancelAnimationFrame(raf)
      el.style.removeProperty('--hero-image-scale')
    }
  }, [heroRef, active])
}
