/**
 * Full review lives at `/stations/pending-review` but can be opened from `/stations` or
 * `/station-database-edit` (same component; edit vs view default). Pass `state.from`
 * when navigating so Back returns to the correct surface.
 */
export type ReviewPendingLocationState = {
  from: string
}

export function pathnameForReviewPendingSource(location: { pathname: string; search: string }): string {
  return `${location.pathname}${location.search}`
}

/** Only allow same-origin relative paths (open-redirect safe). */
export function safeReviewPendingReturnPath(from: unknown): string | null {
  if (typeof from !== 'string' || !from.startsWith('/')) return null
  if (from.startsWith('//') || from.includes('://')) return null
  return from
}
