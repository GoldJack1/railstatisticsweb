import { type RefObject, useEffect } from 'react'

/** Optional scroll roots whose `scroll` events do not bubble (e.g. locked hero copy panels). */
export interface UseHeroImageMotionOptions {
  ancestorScrollRoots?: ReadonlyArray<RefObject<HTMLElement | null>>
  /** Re-bind listeners when layout changes (e.g. ref attached or overflow toggled). */
  ancestorScrollResyncKey?: string | number
}

/**
 * As the hero’s top edge moves above the viewport, progress runs 0→1 over one hero-height of scroll;
 * scale becomes `1 + progress * MAX_SCROLL_SCALE_DELTA`, then multiplied by `NARROW_VIEWPORT_IMAGE_SCALE`
 * when `max-width: 409px` so the art reads smaller on very narrow phones.
 */
const MAX_SCROLL_SCALE_DELTA = 1
/** Must match hero CSS `@media (max-width: 409px)` — scales `--hero-image-scale` for both scroll motion and static fallback. */
const NARROW_VIEWPORT_IMAGE_SCALE = 0.75
const NARROW_VIEWPORT_MQ = '(max-width: 409px)'

/** While the hero is on screen, sample this often on touch UIs (iOS/Android often under-report `scroll`). */
const TOUCH_VISIBILITY_POLL_MS = 80

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function isTouchLikeUi(): boolean {
  return (
    window.matchMedia('(any-pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches
  )
}

/**
 * Drives `--hero-image-scale` on the hero section. Progress is 0→1 from:
 * - document scroll: hero’s top edge moving up through the viewport (one band-height of scroll), and
 * - optional inner panels (`ancestorScrollRoots`): their own scrollTop / scroll range (they do not move the hero’s rect).
 *
 * Uses the max of those progresses so scaling still responds when users read overflow copy inside the band.
 * Respects `prefers-reduced-motion`.
 *
 * Touch / WebKit: also listens on `document` / `body`, `touchmove`, and briefly polls while the hero
 * intersects the viewport so real devices match desktop emulation (where wheel scroll hits `window`).
 *
 * @param active When false, skips setup (e.g. hero not mounted yet).
 * @param options Optional inner scroll containers (scroll does not bubble to `window`).
 */
export function useHeroImageMotion(
  heroRef: RefObject<HTMLElement | null>,
  active = true,
  options?: UseHeroImageMotionOptions
): void {
  useEffect(() => {
    if (!active) return
    const el = heroRef.current
    if (!el) return

    let raf = 0
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const narrowMq = window.matchMedia(NARROW_VIEWPORT_MQ)

    const computeAndSetScale = () => {
      if (mq.matches) {
        el.style.removeProperty('--hero-image-scale')
        return
      }

      const rect = el.getBoundingClientRect()
      let progress = clamp((-rect.top) / Math.max(rect.height, 1), 0, 1)
      for (const r of options?.ancestorScrollRoots ?? []) {
        const node = r.current
        if (!node) continue
        const range = node.scrollHeight - node.clientHeight
        if (range < 1) continue
        const inner = clamp(node.scrollTop / range, 0, 1)
        progress = Math.max(progress, inner)
      }
      const base = 1 + progress * MAX_SCROLL_SCALE_DELTA
      const narrow = narrowMq.matches ? NARROW_VIEWPORT_IMAGE_SCALE : 1
      const scale = base * narrow
      el.style.setProperty('--hero-image-scale', scale.toFixed(4))
    }

    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        computeAndSetScale()
      })
    }

    computeAndSetScale()

    window.addEventListener('scroll', schedule, { passive: true })
    const docScrollOpts: AddEventListenerOptions = { passive: true, capture: true }
    document.addEventListener('scroll', schedule, docScrollOpts)
    document.body?.addEventListener('scroll', schedule, { passive: true })

    const scrollDoc = document.scrollingElement ?? document.documentElement
    scrollDoc.addEventListener('scroll', schedule, { passive: true })

    const vv = window.visualViewport
    vv?.addEventListener('scroll', schedule, { passive: true })
    vv?.addEventListener('resize', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('touchmove', schedule, { passive: true })
    window.addEventListener('wheel', schedule, { passive: true })

    const innerScrollNodes: HTMLElement[] = []
    for (const r of options?.ancestorScrollRoots ?? []) {
      const node = r.current
      if (node) {
        node.addEventListener('scroll', schedule, { passive: true })
        innerScrollNodes.push(node)
      }
    }

    const touchLike = isTouchLikeUi()
    /** DOM timer id; typed as `number` to avoid Node `Timeout` vs browser `number` mismatch in tooling. */
    let pollId: number | null = null
    const stopPoll = () => {
      if (pollId != null) {
        window.clearInterval(pollId)
        pollId = null
      }
    }
    const startPoll = () => {
      if (!touchLike || pollId != null) return
      pollId = window.setInterval(() => computeAndSetScale(), TOUCH_VISIBILITY_POLL_MS)
    }

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting)
        if (vis) startPoll()
        else stopPoll()
      },
      { root: null, threshold: 0 }
    )
    io.observe(el)

    const onMq = () => computeAndSetScale()
    mq.addEventListener('change', onMq)
    narrowMq.addEventListener('change', onMq)

    return () => {
      io.disconnect()
      stopPoll()
      window.removeEventListener('scroll', schedule)
      document.removeEventListener('scroll', schedule, docScrollOpts)
      document.body?.removeEventListener('scroll', schedule)
      scrollDoc.removeEventListener('scroll', schedule)
      vv?.removeEventListener('scroll', schedule)
      vv?.removeEventListener('resize', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('touchmove', schedule)
      window.removeEventListener('wheel', schedule)
      for (const node of innerScrollNodes) {
        node.removeEventListener('scroll', schedule)
      }
      mq.removeEventListener('change', onMq)
      narrowMq.removeEventListener('change', onMq)
      if (raf) cancelAnimationFrame(raf)
      el.style.removeProperty('--hero-image-scale')
    }
  }, [heroRef, active, options?.ancestorScrollResyncKey])
}
