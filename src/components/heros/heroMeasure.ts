/** Extra px so rounding / font rasterization does not let the live block exceed the locked shell height. */
export const TEXT_SHELL_HEIGHT_BUFFER_PX = 6
/** Same idea for the shared CTA row slot when any slide has buttons. */
export const CTA_SLOT_HEIGHT_BUFFER_PX = 4

export function measureBlockHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect().height
  return Math.max(el.offsetHeight, el.scrollHeight, rect)
}

export function scheduleDoubleRaf(fn: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}
