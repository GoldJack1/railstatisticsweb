const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/
const DD_MM_YYYY_DASH = /^(\d{2})-(\d{2})-(\d{4})$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Convert stored SuperTram date (dd/mm/yyyy) to `<input type="date">` value (yyyy-mm-dd). */
export function storedDateToIsoDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const slashMatch = trimmed.match(DD_MM_YYYY)
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch
    return `${yyyy}-${mm}-${dd}`
  }

  const dashMatch = trimmed.match(DD_MM_YYYY_DASH)
  if (dashMatch) {
    const [, dd, mm, yyyy] = dashMatch
    return `${yyyy}-${mm}-${dd}`
  }

  if (ISO_DATE.test(trimmed)) {
    return trimmed
  }

  return ''
}

/** Convert `<input type="date">` value to dd/mm/yyyy for Firestore. */
export function isoDateToDdMmYyyy(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const match = trimmed.match(ISO_DATE)
  if (!match) return ''

  const [, yyyy, mm, dd] = match
  return `${dd}/${mm}/${yyyy}`
}
