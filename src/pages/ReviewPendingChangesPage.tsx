import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStations } from '../hooks/useStations'
import Button from '../components/Button'
import PendingChangesReviewPanel from '../components/PendingChangesReviewPanel'
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

  const fromState = safeReviewPendingReturnPath((location.state as { from?: string } | null)?.from)
  const backTarget =
    fromState && fromState !== '/stations/pending-review' ? fromState : '/stations'

  const goBackToStations = () => navigate(backTarget)

  if (loading) {
    return (
      <div className="container container--station-details">
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
      <div className="container container--station-details">
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
    <div className="container container--station-details">
      <div className="station-details-page">
        <header className="station-details-header">
          <div>
            <h1 className="station-details-title">Review pending changes</h1>
            <div className="station-details-subtitle review-pending-page__header-subtitle">
              {pendingCount > 0 ? (
                <span>
                  {pendingCount} local edit{pendingCount === 1 ? '' : 's'} — publish now or schedule per station
                </span>
              ) : (
                <span>No staged edits right now</span>
              )}
              <span className="review-pending-page__collection-line">
                Data source: <span className="review-pending-page__collection-name">{collectionLabel}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="station-details-main review-pending-page__main">
          {pendingCount === 0 ? (
            <div className="review-pending-page__empty">
              <p>When you save edits in the station database, they appear here before publishing.</p>
              <p className="review-pending-page__collection-inline">
                Data source: <strong>{collectionLabel}</strong>
              </p>
              <Button variant="wide" width="hug" onClick={goBackToStations}>
                Back to stations
              </Button>
            </div>
          ) : (
            <PendingChangesReviewPanel
              visible
              reviewActive
              layout="page"
              refetch={refetch}
              onPublishSuccess={goBackToStations}
              renderPageActionBar={api => (
                <div
                  className="review-pending-page__action-bar"
                  role="toolbar"
                  aria-label="Review navigation and publish actions"
                >
                  <div className="review-pending-page__action-bar-back">
                    <Button type="button" variant="wide" width="hug" onClick={goBackToStations}>
                      Back
                    </Button>
                  </div>
                  <div className="review-pending-page__action-bar-end" role="group" aria-label="Publish and schedule">
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      onClick={api.openPublishModal}
                      disabled={api.publishDisabled}
                    >
                      Publish now
                    </Button>
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      onClick={api.openScheduleModal}
                      disabled={api.scheduleDisabled}
                    >
                      Schedule
                    </Button>
                  </div>
                </div>
              )}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default ReviewPendingChangesPage
