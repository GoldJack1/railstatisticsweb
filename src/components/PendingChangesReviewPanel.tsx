import React, { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import Button from './Button'
import PendingChangesActionModal, { type PendingActionModalMode } from './PendingChangesActionModal'
import { usePendingChangesPublishFlow } from '../hooks/usePendingChangesPublishFlow'
import { getFieldChangesForPendingReview } from '../utils/pendingChangeFieldDiffs'
import { computePendingChangesFingerprint } from '../utils/pendingChangesFingerprint'
import { readScheduleSavedFingerprint } from '../utils/scheduledPublishStorage'
import './Stations.css'
import './PendingChangesReviewPanel.css'

export type PendingChangesReviewLayout = 'page' | 'compact'

/** Passed to `renderPageActionBar` so the host page can render Back + Publish/Schedule under the page title. */
export interface PendingReviewPageActionBarApi {
  openPublishModal: () => void
  openScheduleModal: () => void
  canMasterPublish: boolean
  isPublishingAll: boolean
  isSavingSchedule: boolean
  publishDisabled: boolean
  scheduleDisabled: boolean
}

export interface PendingChangesReviewPanelProps {
  visible: boolean
  reviewActive: boolean
  refetch: () => void | Promise<void>
  onPublishSuccess?: () => void
  onBack?: () => void
  /** `page` = wide grid + table on desktop; `compact` = stacked cards (sidebar). */
  layout?: PendingChangesReviewLayout
  /**
   * When set, Publish/Schedule are not shown in the panel intro; render this above the “Choose what to publish” block
   * (e.g. same row as Back on the full review page).
   */
  renderPageActionBar?: (api: PendingReviewPageActionBarApi) => ReactNode
}

type RowMode = 'none' | 'publish' | 'schedule'

const PendingChangesReviewPanel: React.FC<PendingChangesReviewPanelProps> = ({
  visible,
  reviewActive,
  refetch,
  onPublishSuccess,
  onBack,
  layout = 'compact',
  renderPageActionBar
}) => {
  const flow = usePendingChangesPublishFlow({ refetch, reviewActive, onPublishSuccess })
  const [actionModal, setActionModal] = useState<PendingActionModalMode | null>(null)
  const [rowModes, setRowModes] = useState<Record<string, RowMode>>({})

  const pendingIds = useMemo(() => Object.keys(flow.pendingChanges).sort(), [flow.pendingChanges])

  useEffect(() => {
    setRowModes(prev => {
      const next: Record<string, RowMode> = {}
      for (const id of pendingIds) {
        next[id] = prev[id] ?? 'none'
      }
      return next
    })
  }, [pendingIds])

  const setRowMode = useCallback((stationId: string, mode: RowMode) => {
    setRowModes(prev => ({ ...prev, [stationId]: mode }))
  }, [])

  const setAllRows = useCallback(
    (mode: RowMode) => {
      const next: Record<string, RowMode> = {}
      for (const id of pendingIds) {
        next[id] = mode
      }
      setRowModes(next)
    },
    [pendingIds]
  )

  const publishIds = useMemo(
    () => pendingIds.filter(id => rowModes[id] === 'publish'),
    [pendingIds, rowModes]
  )
  const scheduleIds = useMemo(
    () => pendingIds.filter(id => rowModes[id] === 'schedule'),
    [pendingIds, rowModes]
  )

  const scheduleEditDrift = useMemo(() => {
    if (!flow.trackedScheduledJobId) return false
    const saved = readScheduleSavedFingerprint()
    if (saved == null) return false
    return computePendingChangesFingerprint(flow.pendingChanges) !== saved
  }, [flow.trackedScheduledJobId, flow.pendingChanges])

  const scheduledRunIds = useMemo(
    () => new Set(flow.serverScheduledJobDetail?.stationIds ?? []),
    [flow.serverScheduledJobDetail?.stationIds]
  )

  const labelForScheduledStation = useCallback(
    (id: string) =>
      flow.serverScheduledJobDetail?.stationLabels[id]?.trim() ||
      flow.pendingChanges[id]?.original.stationName?.trim() ||
      `ID ${id}`,
    [flow.serverScheduledJobDetail?.stationLabels, flow.pendingChanges]
  )

  if (!visible || flow.pendingCount === 0) {
    return null
  }

  const {
    user,
    pendingChanges,
    canMasterPublish,
    isPublishingAll,
    isSavingSchedule,
    scheduleLocalNowMs,
    trackedScheduledJobId,
    serverScheduledJobDetail,
    preparePublishReauth,
    prepareScheduleReauth,
    prepareCancelScheduleReauth,
    completeReauthVerified,
    clearReauthIntent
  } = flow

  const openPublishModal = () => {
    if (publishIds.length === 0) {
      window.alert('Select at least one station with Publish now.')
      return
    }
    if (!canMasterPublish) {
      window.alert('Only the site owner can publish live database changes.')
      return
    }
    setActionModal('publish')
  }

  const openScheduleModal = () => {
    if (scheduleIds.length === 0) {
      window.alert('Select at least one station with Schedule.')
      return
    }
    if (!canMasterPublish) {
      window.alert('Only the site owner can schedule live database changes.')
      return
    }
    setActionModal('schedule')
  }

  const openCancelScheduleModal = () => {
    if (!trackedScheduledJobId) return
    if (!canMasterPublish) {
      window.alert('Only the site owner can cancel a server schedule.')
      return
    }
    setActionModal('cancelSchedule')
  }

  const shellClass =
    layout === 'page' ? 'pending-review-shell pending-review-shell--page' : 'pending-review-shell pending-review-shell--compact'

  const renderTableRow = (stationId: string, entry: (typeof pendingChanges)[string]) => {
    const { original } = entry
    const changes = getFieldChangesForPendingReview(entry)
    const mode = rowModes[stationId] ?? 'none'
    const inServerSchedule = scheduledRunIds.has(stationId)

    return (
      <React.Fragment key={stationId}>
        <tr>
          <td>
            <span className="pending-review-table__station-row">
              <span className="pending-review-table__station">{original.stationName || 'Untitled station'}</span>
              {inServerSchedule && (
                <span className="pending-review-scheduled-badge" title="Included in the active server schedule">
                  In server run
                </span>
              )}
            </span>
            <span className="pending-review-table__meta">
              {original.crsCode || 'No CRS'} · ID {stationId}
            </span>
          </td>
          <td className="pending-review-table__count">
            {changes.length} field{changes.length === 1 ? '' : 's'}
            {changes.length > 0 && (
              <details className="pending-review-table__details">
                <summary className="pending-review-schedule-picker-summary">View</summary>
                <ul className="pending-review-change-list" style={{ marginTop: 'var(--space-md)' }}>
                  {changes.map(change => (
                    <li key={change.label} className="pending-review-change">
                      <div className="pending-review-change-label">{change.label}</div>
                      <div className="pending-review-change-values">
                        <span className="pending-review-change-from">{change.from}</span>
                        <span className="pending-review-change-arrow">→</span>
                        <span className="pending-review-change-to">{change.to}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </td>
          <td className="pending-review-table__check">
            <label>
              <input
                type="checkbox"
                checked={mode === 'publish'}
                onChange={e => setRowMode(stationId, e.target.checked ? 'publish' : 'none')}
                disabled={isPublishingAll || isSavingSchedule}
                aria-label={`Publish now: ${original.stationName || stationId}`}
              />
            </label>
          </td>
          <td className="pending-review-table__check">
            <label>
              <input
                type="checkbox"
                checked={mode === 'schedule'}
                onChange={e => setRowMode(stationId, e.target.checked ? 'schedule' : 'none')}
                disabled={isPublishingAll || isSavingSchedule}
                aria-label={`Schedule: ${original.stationName || stationId}`}
              />
            </label>
          </td>
        </tr>
      </React.Fragment>
    )
  }

  const renderCard = (stationId: string, entry: (typeof pendingChanges)[string]) => {
    const { original } = entry
    const changes = getFieldChangesForPendingReview(entry)
    const mode = rowModes[stationId] ?? 'none'
    const inServerSchedule = scheduledRunIds.has(stationId)

    return (
      <article key={stationId} className="pending-review-card">
        <div className="pending-review-card__head">
          <div className="pending-review-card__title-row">
            <div className="pending-review-table__station">{original.stationName || 'Untitled station'}</div>
            {inServerSchedule && (
              <span className="pending-review-scheduled-badge" title="Included in the active server schedule">
                In server run
              </span>
            )}
          </div>
          <span className="pending-review-table__meta">
            {original.crsCode || 'No CRS'} · ID {stationId} · {changes.length} field{changes.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="pending-review-row__checks">
          <label>
            <input
              type="checkbox"
              checked={mode === 'publish'}
              onChange={e => setRowMode(stationId, e.target.checked ? 'publish' : 'none')}
              disabled={isPublishingAll || isSavingSchedule}
              aria-label={`Publish now: ${original.stationName || stationId}`}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={mode === 'schedule'}
              onChange={e => setRowMode(stationId, e.target.checked ? 'schedule' : 'none')}
              disabled={isPublishingAll || isSavingSchedule}
              aria-label={`Schedule: ${original.stationName || stationId}`}
            />
          </label>
        </div>
        {changes.length > 0 && (
          <details className="pending-review-row__details">
            <summary className="pending-review-schedule-picker-summary">View changes</summary>
            <ul className="pending-review-change-list" style={{ marginTop: 'var(--space-md)' }}>
              {changes.map(change => (
                <li key={change.label} className="pending-review-change">
                  <div className="pending-review-change-label">{change.label}</div>
                  <div className="pending-review-change-values">
                    <span className="pending-review-change-from">{change.from}</span>
                    <span className="pending-review-change-arrow">→</span>
                    <span className="pending-review-change-to">{change.to}</span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </article>
    )
  }

  const actionBarApi: PendingReviewPageActionBarApi = {
    openPublishModal,
    openScheduleModal,
    canMasterPublish,
    isPublishingAll,
    isSavingSchedule,
    publishDisabled: isPublishingAll || isSavingSchedule || !canMasterPublish || publishIds.length === 0,
    scheduleDisabled: isPublishingAll || isSavingSchedule || !canMasterPublish || scheduleIds.length === 0
  }

  const introSubtitle = renderPageActionBar ? (
    <p className="pending-review-subtitle">
      Use the table below to mark each station for <strong>Publish now</strong> or <strong>Schedule</strong>. Each
      station can only be one or the other (or left unchecked for now). When you are ready, use{' '}
      <strong>Publish now</strong> or <strong>Schedule</strong> in the row above.
    </p>
  ) : (
    <p className="pending-review-subtitle">
      Use the columns to mark stations for <strong>Publish now</strong> or <strong>Schedule</strong>, then use the
      buttons to confirm. Each station can only be one or the other (or left unchecked to skip for now).
    </p>
  )

  return (
    <>
      {renderPageActionBar?.(actionBarApi)}
      <section className={shellClass} aria-label="Review pending station changes before publishing">
        <div
          className={
            renderPageActionBar
              ? 'pending-review-shell__intro'
              : 'pending-review-shell__intro pending-review-shell__intro--with-actions'
          }
        >
          <div className="pending-review-shell__intro-text">
            <h2 className="pending-review-title">Choose what to publish</h2>
            {introSubtitle}
          </div>
          {!renderPageActionBar && (
            <div className="pending-review-shell__intro-actions" role="group" aria-label="Publish and schedule">
              <Button
                type="button"
                variant="wide"
                width="hug"
                onClick={openPublishModal}
                disabled={actionBarApi.publishDisabled}
              >
                Publish now
              </Button>
              <Button
                type="button"
                variant="wide"
                width="hug"
                onClick={openScheduleModal}
                disabled={actionBarApi.scheduleDisabled}
              >
                Schedule
              </Button>
            </div>
          )}
        </div>

        {!canMasterPublish && (
          <p className="pending-review-master-notice" role="status">
            Only the site owner can publish or schedule live database changes. You can still review selections locally.
          </p>
        )}

        {(trackedScheduledJobId || serverScheduledJobDetail) && (
          <div className="pending-review-scheduled-strip" role="region" aria-label="Active scheduled publish">
            <div className="pending-review-scheduled-strip__row">
              <div className="pending-review-scheduled-strip__text">
                <span className="pending-review-scheduled-strip__label">Scheduled publish</span>
                {serverScheduledJobDetail ? (
                  <span className="pending-review-scheduled-strip__detail">
                    <strong>{serverScheduledJobDetail.stationIds.length}</strong> station
                    {serverScheduledJobDetail.stationIds.length === 1 ? '' : 's'} · status{' '}
                    <strong>{serverScheduledJobDetail.status}</strong>
                    {' · '}
                    run at <strong>{new Date(serverScheduledJobDetail.runAtMs).toLocaleString()}</strong>
                    {serverScheduledJobDetail.errorMessage && (
                      <span className="pending-review-schedule-error"> — {serverScheduledJobDetail.errorMessage}</span>
                    )}
                  </span>
                ) : (
                  <span className="pending-review-scheduled-strip__detail">Job registered; syncing status…</span>
                )}
              </div>
              <Button
                type="button"
                variant="wide"
                width="hug"
                onClick={openCancelScheduleModal}
                disabled={isPublishingAll || isSavingSchedule || !trackedScheduledJobId || !canMasterPublish}
              >
                Cancel schedule
              </Button>
            </div>
            {serverScheduledJobDetail && serverScheduledJobDetail.stationIds.length > 0 && (
              <details className="pending-review-scheduled-stations" open={serverScheduledJobDetail.stationIds.length <= 8}>
                <summary className="pending-review-scheduled-stations__summary">
                  Stations in this run ({serverScheduledJobDetail.stationIds.length})
                </summary>
                <ul className="pending-review-scheduled-stations__list">
                  {serverScheduledJobDetail.stationIds.map(id => (
                    <li key={id} className="pending-review-scheduled-stations__item">
                      <span className="pending-review-scheduled-stations__name">{labelForScheduledStation(id)}</span>
                      <span className="pending-review-scheduled-stations__id">ID {id}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {scheduleEditDrift && (
          <p className="pending-review-schedule-drift" role="status">
            Your local pending queue has changed since this schedule was saved. The run will still apply the snapshot
            from that time — <strong>schedule again</strong> if you need newer edits included in the server job.
          </p>
        )}

        <div className="pending-review-shell__main-only">
          <div className="pending-review-toolbar" role="group" aria-label="Select all stations">
              <span className="pending-review-toolbar__label">Set all</span>
              <Button
                type="button"
                variant="chip"
                width="hug"
                onClick={() => setAllRows('publish')}
                disabled={isPublishingAll || isSavingSchedule}
              >
                All publish now
              </Button>
              <Button
                type="button"
                variant="chip"
                width="hug"
                onClick={() => setAllRows('schedule')}
                disabled={isPublishingAll || isSavingSchedule}
              >
                All schedule
              </Button>
              <Button
                type="button"
                variant="chip"
                width="hug"
                onClick={() => setAllRows('none')}
                disabled={isPublishingAll || isSavingSchedule}
              >
                Clear
              </Button>
            </div>

            <div className="pending-review-table-wrap">
              <table className="pending-review-table">
                <thead>
                  <tr>
                    <th scope="col">Station</th>
                    <th scope="col">Changes</th>
                    <th scope="col">Publish now</th>
                    <th scope="col">Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingIds.map(stationId => {
                    const entry = pendingChanges[stationId]
                    if (!entry) return null
                    return renderTableRow(stationId, entry)
                  })}
                </tbody>
              </table>
            </div>

            <div className="pending-review-cards">
              {pendingIds.map(stationId => {
                const entry = pendingChanges[stationId]
                if (!entry) return null
                return renderCard(stationId, entry)
              })}
            </div>
        </div>

        {layout === 'compact' && onBack && (
          <div className="pending-review-actions pending-review-actions--compact-footer">
            <Button
              type="button"
              variant="wide"
              width="fill"
              className="pending-review-cancel"
              onClick={onBack}
              disabled={isPublishingAll || isSavingSchedule}
            >
              Back
            </Button>
          </div>
        )}
      </section>

      <PendingChangesActionModal
        open={actionModal !== null}
        mode={actionModal ?? 'publish'}
        onClose={() => {
          clearReauthIntent()
          setActionModal(null)
        }}
        user={user}
        publishStationIds={publishIds}
        scheduleStationIds={scheduleIds}
        pendingChanges={pendingChanges}
        trackedScheduledJobId={trackedScheduledJobId}
        serverScheduledJobDetail={serverScheduledJobDetail}
        scheduleLocalNowMs={scheduleLocalNowMs}
        preparePublishReauth={preparePublishReauth}
        prepareScheduleReauth={prepareScheduleReauth}
        prepareCancelScheduleReauth={prepareCancelScheduleReauth}
        onReauthSuccess={completeReauthVerified}
        clearReauthIntent={clearReauthIntent}
      />
    </>
  )
}

export default PendingChangesReviewPanel
