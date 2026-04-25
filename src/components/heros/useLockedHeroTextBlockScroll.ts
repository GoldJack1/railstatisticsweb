import { useLayoutEffect, type RefObject } from 'react'

/**
 * Locked hero copy shells use a fixed height; only enable `overflow-y: auto` when content actually overflows
 * so trackpad / touch does not create a spurious scroll region.
 */
export function useLockedHeroTextBlockScroll(
  textBlockRef: RefObject<HTMLDivElement | null>,
  locked: boolean,
  scrollClassName: string,
  /** Bust the effect when layout-driving inputs change (slide, locked height, etc.). */
  layoutKey: string
): void {
  useLayoutEffect(() => {
    const block = textBlockRef.current
    if (!block) return
    if (!locked) {
      block.classList.remove(scrollClassName)
      return
    }
    const sync = () => {
      const el = textBlockRef.current
      if (!el) return
      const needsScroll = el.scrollHeight > el.clientHeight + 2
      el.classList.toggle(scrollClassName, needsScroll)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(block)
    return () => {
      ro.disconnect()
      block.classList.remove(scrollClassName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- textBlockRef is stable; layoutKey drives resync
  }, [locked, scrollClassName, layoutKey])
}
