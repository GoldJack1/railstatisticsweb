import React, { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStations } from '../hooks/useStations'
import Button from '../components/Button'
import PendingChangesReviewPanel, {
  type PendingReviewPageTab
} from '../components/PendingChangesReviewPanel'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import { useStationCollection } from '../contexts/StationCollectionContext'
import { getStationCollectionDisplayLabel } from '../services/firebase'
import { safeReviewPendingReturnPath } from '../utils/reviewPendingNavigation'
import './StationDetailsPage.css'
import './ReviewPendingChangesPage.css'

const ReviewPendingChangesPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, refetch } = useStations()
  const { pendingChanges } = usePendingStationChanges()
  const { collectionId } = useStationCollection()
  const pendingCount = Object.keys(pendingChanges).length
  const collectionLabel = getStationCollectionDisplayLabel(collectionId)
  const [reviewTab, setReviewTab] = useState<PendingReviewPageTab>('pending')

  const fromState = safeReviewPendingReturnPath((location.state as { from?: string } | null)?.from)
  const fallbackBackTarget =
    fromState && fromState !== '/stations/pending-review' ? fromState : '/stations'

  const goBackToPreviousPage = useCallback(() => {
    // Prefer explicit in-app origin captured when opening pending review.
    if (fromState && fromState !== '/stations/pending-review') {
      navigate(fromState)
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(fallbackBackTarget, { replace: true })
  }, [navigate, fromState, fallbackBackTarget])

  if (loading) {
    return (
      <div className="container container--station-details review-pending-page">
        <div className="review-pending-page__state">
          <div className="loading-spinner" />
          <p>Loading…</p>
          <p className="review-pending-page__collection-note">Data source: {collectionLabel}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container container--station-details review-pending-page">
        <div className="review-pending-page__state review-pending-page__state--error">
          <p>{error}</p>
          <p className="review-pending-page__collection-note">Data source: {collectionLabel}</p>
          <Button variant="wide" width="hug" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container container--station-details review-pending-page">
      <div className="station-details-page">
        <header className="station-details-header">
          <div>
            <h1 className="station-details-title">Review pending changes</h1>
            <div className="station-details-subtitle review-pending-page__header-subtitle">
              {pendingCount > 0 ? (
                <span>
                  {pendingCount} local edit{pendingCount === 1 ? '' : 's'} — use the Pending changes tab to publish or
                  schedule per station; server jobs live under Schedules.
                </span>
              ) : (
                <span>No staged edits — open the Schedules tab to view or cancel server publish jobs.</span>
              )}
              <span className="review-pending-page__collection-line">
                Data source: <span className="review-pending-page__collection-name">{collectionLabel}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="station-details-main review-pending-page__main">
          <PendingChangesReviewPanel
            visible
            reviewActive
            layout="page"
            refetch={refetch}
            onPublishSuccess={goBackToPreviousPage}
            pageTab={reviewTab}
            onPageTabChange={setReviewTab}
            renderPageActionBar={api => (
              <div
                className="review-pending-page__action-bar"
                role="toolbar"
                aria-label="Review navigation and publish actions"
              >
                <div className="review-pending-page__action-bar-back">
                  <Button
                    type="button"
                    variant="wide"
                    width="hug"
                    instantAction
                    onClick={goBackToPreviousPage}
                  >
                    Back
                  </Button>
                </div>
                {reviewTab === 'pending' && (
                  <div className="review-pending-page__action-bar-end" role="group" aria-label="Publish and schedule">
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      instantAction
                      onClick={api.openPublishModal}
                      disabled={api.publishDisabled}
                    >
                      Publish now
                    </Button>
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      instantAction
                      onClick={api.openScheduleModal}
                      disabled={api.scheduleDisabled}
                    >
                      Schedule
                    </Button>
                  </div>
                )}
              </div>
            )}
          />
        </main>
      </div>
    </div>
  )
}

export default ReviewPendingChangesPage
