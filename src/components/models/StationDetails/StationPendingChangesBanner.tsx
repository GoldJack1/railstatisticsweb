import type { StationFieldChange } from '../../../utils/stationFieldDiffs'
import '../PendingChangesReviewPanel/PendingChangesReviewPanel.css'
import './StationPendingChangesBanner.css'

interface StationPendingChangesBannerProps {
  changes: StationFieldChange[]
  isNew?: boolean
}

export function StationPendingChangesBanner({ changes, isNew = false }: StationPendingChangesBannerProps) {
  if (changes.length === 0 && !isNew) return null

  return (
    <aside className="station-details-pending-banner" aria-label="Unpublished changes">
      <p className="station-details-pending-banner__title">
        {isNew
          ? 'This station is new and has not been published yet.'
          : `${changes.length} unpublished change${changes.length === 1 ? '' : 's'} — values below reflect your staged edits until published.`}
      </p>
      {changes.length > 0 && (
        <ul className="pending-review-change-list pending-review-change-list--card station-details-pending-banner__list">
          {changes.map((change) => (
            <li key={change.label} className="pending-review-change pending-review-change--review">
              <div className="pending-review-change-label">{change.label}</div>
              <div className="pending-review-change-values">
                <span className="pending-review-change-from">{change.from}</span>
                <span className="pending-review-change-arrow" aria-hidden>
                  →
                </span>
                <span className="pending-review-change-to">{change.to}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

export default StationPendingChangesBanner
