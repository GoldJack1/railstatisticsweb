import React, { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import Button from './Button'
import ButtonBar from './ButtonBar'
import PendingChangesActionModal, { type PendingActionModalMode } from './PendingChangesActionModal'
import { usePendingChangesPublishFlow } from '../hooks/usePendingChangesPublishFlow'
import { useMyScheduleJobsForReview } from '../hooks/useMyScheduleJobsForReview'
import {
  getStationCollectionDisplayLabel,
  type PendingScheduleJobSummary,
  type StationCollectionId
} from '../services/firebase'
import { getFieldChangesForPendingReview } from '../utils/pendingChangeFieldDiffs'
import { computePendingChangesFingerprint } from '../utils/pendingChangesFingerprint'
import { readScheduleSavedFingerprint } from '../utils/scheduledPublishStorage'
import './Stations.css'
import './PendingChangesReviewPanel.css'

function collectionLabelForJob(collectionId: string | undefined): string {
  if (collectionId === 'stations2603' || collectionId === 'newsandboxstations1') {
    return getStationCollectionDisplayLabel(collectionId as StationCollectionId)
  }
  return collectionId?.trim() ? collectionId : '—'
}

function isScheduleStatusCurrent(status: string): boolean {
  return status === 'pending' || status === 'processing'
}

function scheduleStatusStyleClass(
  status: string
): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'unknown' {
  if (status === 'pending') return 'pending'
  if (status === 'processing') return 'processing'
  if (status === 'completed') return 'completed'
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'cancelled'
  return 'unknown'
}

/** Replaced when saving a merged schedule (added stations, etc.); still `status: cancelled` in Firestore. */
function isScheduleSupersededCancelledJob(job: PendingScheduleJobSummary): boolean {
  return job.status === 'cancelled' && job.cancelReason === 'superseded'
}

function scheduleJobStatusPillClassName(job: PendingScheduleJobSummary): string {
  const base = 'pending-review-schedule-status'
  if (isScheduleSupersededCancelledJob(job)) {
    return `${base} ${base}--superseded`
  }
  return `${base} ${base}--${scheduleStatusStyleClass(job.status)}`
}

function scheduleJobStatusLabel(job: PendingScheduleJobSummary): string {
  if (isScheduleSupersededCancelledJob(job)) {
    return 'Cancelled & modified'
  }
  return job.status || 'unknown'
}

/** Firestore allows delete for own jobs; UI only offers it for terminal rows (not pending/processing). */
function scheduleJobCanDeleteFromHistory(job: PendingScheduleJobSummary): boolean {
  const s = job.status
  return s === 'cancelled' || s === 'completed' || s === 'failed'
}

function cancelledScheduleExplanation(job: PendingScheduleJobSummary): React.ReactNode {
  if (job.cancelReason === 'superseded' && job.supersededByJobId) {
    return (
      <>
        Replaced when you saved an updated schedule (e.g. added stations). The list below is the{' '}
        <strong>previous</strong> snapshot. New job:{' '}
        <code className="pending-review-inline-code">{job.supersededByJobId}</code>
      </>
    )
  }
  if (job.cancelReason === 'publish') {
    return <>Removed when you published all pending changes from the review page.</>
  }
  if (job.cancelReason === 'user') {
    return <>Cancelled from the schedules list.</>
  }
  return <>Cancelled (older jobs may not record how).</>
}

export type PendingChangesReviewLayout = 'page' | 'compact'

export type PendingReviewPageTab = 'pending' | 'schedules'

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
  /** Full-page review only: tab between pending queue and server schedules. */
  pageTab?: PendingReviewPageTab
  onPageTabChange?: (tab: PendingReviewPageTab) => void
}

type RowMode = 'none' | 'publish' | 'schedule'

const PendingChangesReviewPanel: React.FC<PendingChangesReviewPanelProps> = ({
  visible,
  reviewActive,
  refetch,
  onPublishSuccess,
  onBack,
  layout = 'compact',
  renderPageActionBar,
  pageTab,
  onPageTabChange
}) => {
  const flow = usePendingChangesPublishFlow({ refetch, reviewActive, onPublishSuccess })
  const [actionModal, setActionModal] = useState<PendingActionModalMode | null>(null)
  const [cancelScheduleTargetJob, setCancelScheduleTargetJob] = useState<PendingScheduleJobSummary | null>(null)
  const [deletingScheduleJobId, setDeletingScheduleJobId] = useState<string | null>(null)
  const [rowModes, setRowModes] = useState<Record<string, RowMode>>({})

  const scheduleJobsSubscribeEnabled = Boolean(
    visible && reviewActive && flow.user?.uid && (layout === 'page' || flow.pendingCount > 0)
  )
  const { rows: scheduleJobRows, loading: scheduleJobsLoading, error: scheduleJobsError } =
    useMyScheduleJobsForReview(flow.user?.uid, scheduleJobsSubscribeEnabled)

  const pendingIds = useMemo(() => Object.keys(flow.pendingChanges).sort(), [flow.pendingChanges])
  const scheduledRunIds = useMemo(() => {
    const set = new Set<string>()
    for (const job of scheduleJobRows) {
      if (isScheduleStatusCurrent(job.status)) {
        for (const id of job.stationIds) {
          set.add(id)
        }
      }
    }
    const detail = flow.serverScheduledJobDetail
    if (detail?.stationIds?.length && isScheduleStatusCurrent(detail.status)) {
      for (const id of detail.stationIds) {
        set.add(id)
      }
    }
    return set
  }, [scheduleJobRows, flow.serverScheduledJobDetail])
  const actionablePendingIds = useMemo(
    () => pendingIds.filter(id => !scheduledRunIds.has(id)),
    [pendingIds, scheduledRunIds]
  )

  useEffect(() => {
    setRowModes(prev => {
      const next: Record<string, RowMode> = {}
      for (const id of actionablePendingIds) {
        next[id] = prev[id] ?? 'none'
      }
      return next
    })
  }, [actionablePendingIds])

  const setRowMode = useCallback((stationId: string, mode: RowMode) => {
    setRowModes(prev => ({ ...prev, [stationId]: mode }))
  }, [])

  const setAllRows = useCallback(
    (mode: RowMode) => {
      const next: Record<string, RowMode> = {}
      for (const id of actionablePendingIds) {
        next[id] = mode
      }
      setRowModes(next)
    },
    [actionablePendingIds]
  )

  const publishIds = useMemo(
    () => actionablePendingIds.filter(id => rowModes[id] === 'publish'),
    [actionablePendingIds, rowModes]
  )
  const scheduleIds = useMemo(
    () => actionablePendingIds.filter(id => rowModes[id] === 'schedule'),
    [actionablePendingIds, rowModes]
  )

  const scheduleEditDrift = useMemo(() => {
    if (!flow.trackedScheduledJobId) return false
    const saved = readScheduleSavedFingerprint()
    if (saved == null) return false
    return computePendingChangesFingerprint(flow.pendingChanges) !== saved
  }, [flow.trackedScheduledJobId, flow.pendingChanges])

  const labelForJobStation = useCallback(
    (job: PendingScheduleJobSummary, stationId: string) =>
      job.stationLabels[stationId]?.trim() ||
      flow.pendingChanges[stationId]?.original.stationName?.trim() ||
      `ID ${stationId}`,
    [flow.pendingChanges]
  )

  const currentScheduleJobs = useMemo(
    () => scheduleJobRows.filter(j => isScheduleStatusCurrent(j.status)),
    [scheduleJobRows]
  )
  const cancelledScheduleJobs = useMemo(
    () => scheduleJobRows.filter(j => j.status === 'cancelled'),
    [scheduleJobRows]
  )
  const finishedScheduleJobs = useMemo(
    () => scheduleJobRows.filter(j => j.status === 'completed' || j.status === 'failed'),
    [scheduleJobRows]
  )

  if (!visible) {
    return null
  }
  if (layout !== 'page' && flow.pendingCount === 0) {
    return null
  }

  const activePageTab: PendingReviewPageTab =
    layout === 'page' ? (pageTab ?? 'pending') : 'pending'
  const isPageTabbed = layout === 'page' && Boolean(onPageTabChange)

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
    deleteScheduleJobFromHistoryById,
    clearPendingChange,
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
    setCancelScheduleTargetJob(null)
    setActionModal('cancelSchedule')
  }

  const openCancelScheduleJobModal = (job: PendingScheduleJobSummary) => {
    if (!canMasterPublish) {
      window.alert('Only the site owner can cancel a server schedule.')
      return
    }
    if (job.status !== 'pending') return
    setCancelScheduleTargetJob(job)
    setActionModal('cancelSchedule')
  }

  const confirmDiscardPendingForStation = (stationId: string, displayName: string) => {
    if (isPublishingAll || isSavingSchedule) return
    const entry = pendingChanges[stationId]
    if (!entry) return
    const name = displayName.trim() || `Station ${stationId}`
    const msg =
      entry.isNew === true
        ? `Remove the new station draft "${name}" from your pending list? This does not delete anything from the database until you publish.`
        : `Discard all pending edits for "${name}"? Your saved station data on the server is unchanged. This does not cancel an existing server schedule for this station.`
    if (!window.confirm(msg)) return
    clearPendingChange(stationId)
  }

  const confirmDeleteScheduleJobHistory = async (job: PendingScheduleJobSummary) => {
    if (!canMasterPublish) {
      window.alert('Only the site owner can delete server schedule jobs.')
      return
    }
    if (!scheduleJobCanDeleteFromHistory(job)) return
    if (
      !window.confirm(
        'Permanently remove this job from your history? It will disappear from this list and cannot be restored.'
      )
    ) {
      return
    }
    setDeletingScheduleJobId(job.id)
    try {
      await deleteScheduleJobFromHistoryById(job.id)
    } finally {
      setDeletingScheduleJobId(null)
    }
  }

  const shellClass =
    layout === 'page' ? 'pending-review-shell pending-review-shell--page' : 'pending-review-shell pending-review-shell--compact'

  const renderPendingChangeList = (
    changes: ReturnType<typeof getFieldChangesForPendingReview>,
    variant: 'table' | 'card'
  ) => {
    if (changes.length === 0) return null
    const listClass =
      variant === 'card'
        ? 'pending-review-change-list pending-review-change-list--card'
        : 'pending-review-change-list pending-review-change-list--table'
    return (
      <ul className={listClass}>
        {changes.map(change => (
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
    )
  }

  const renderTableRow = (stationId: string, entry: (typeof pendingChanges)[string]) => {
    const { original } = entry
    const changes = getFieldChangesForPendingReview(entry)
    const mode = rowModes[stationId] ?? 'none'
    const inServerSchedule = scheduledRunIds.has(stationId)
    const stationTitle = original.stationName || 'Untitled station'

    return (
      <React.Fragment key={stationId}>
        <tr>
          <td className="pending-review-table__station-cell">
            <div className="pending-review-table__station-block">
              <div className="pending-review-table__station-row">
                <span className="pending-review-table__station">{stationTitle}</span>
                {entry.isNew === true && <span className="pending-review-station-chip pending-review-station-chip--new">New</span>}
                {inServerSchedule && (
                  <span
                    className="pending-review-scheduled-badge"
                    title="Included in a pending or processing server schedule"
                  >
                    In server run
                  </span>
                )}
              </div>
              <div className="pending-review-table__chip-row" aria-label="Station identifiers">
                <span className="pending-review-station-chip">{original.crsCode?.trim() || 'No CRS'}</span>
                <span className="pending-review-station-chip pending-review-station-chip--muted">ID {stationId}</span>
              </div>
            </div>
          </td>
          <td className="pending-review-table__count">
            {changes.length === 0 ? (
              <span className="pending-review-table__changes-empty">No field diffs</span>
            ) : (
              <details className="pending-review-table__details">
                <summary className="pending-review-table__changes-summary">
                  <span className="pending-review-table__changes-summary-text">
                    {changes.length} field{changes.length === 1 ? '' : 's'}
                  </span>
                  <span className="pending-review-table__changes-summary-hint">Show</span>
                </summary>
                {renderPendingChangeList(changes, 'table')}
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
                aria-label={`Publish now: ${stationTitle}`}
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
                aria-label={`Schedule: ${stationTitle}`}
              />
            </label>
          </td>
          <td className="pending-review-table__discard">
            <Button
              type="button"
              variant="chip"
              width="hug"
              instantAction
              className="pending-review-discard-btn"
              onClick={() => confirmDiscardPendingForStation(stationId, stationTitle)}
              disabled={isPublishingAll || isSavingSchedule}
              ariaLabel={`Discard pending edits for ${stationTitle}`}
            >
              Discard
            </Button>
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
    const stationTitle = original.stationName || 'Untitled station'

    return (
      <article key={stationId} className="pending-review-card">
        <header className="pending-review-card__header">
          <div className="pending-review-card__title-row">
            <h3 className="pending-review-card__title">{stationTitle}</h3>
          </div>
          <div className="pending-review-card__badges">
            {entry.isNew === true && <span className="pending-review-station-chip pending-review-station-chip--new">New station</span>}
            {inServerSchedule && (
              <span
                className="pending-review-scheduled-badge"
                title="Included in a pending or processing server schedule"
              >
                In server run
              </span>
            )}
          </div>
          <div className="pending-review-card__meta" aria-label="Station identifiers">
            <span className="pending-review-station-chip">{original.crsCode?.trim() || 'No CRS'}</span>
            <span className="pending-review-station-chip pending-review-station-chip--muted">ID {stationId}</span>
            <span className="pending-review-station-chip pending-review-station-chip--stat">
              {changes.length} field{changes.length === 1 ? '' : 's'}
            </span>
          </div>
        </header>

        <div className="pending-review-card__actions" role="group" aria-label={`Publish or schedule: ${stationTitle}`}>
          <label className="pending-review-card__action-row">
            <input
              type="checkbox"
              checked={mode === 'publish'}
              onChange={e => setRowMode(stationId, e.target.checked ? 'publish' : 'none')}
              disabled={isPublishingAll || isSavingSchedule}
              aria-label={`Publish now: ${stationTitle}`}
            />
            <span className="pending-review-card__action-copy">
              <span className="pending-review-card__action-label">Publish now</span>
              <span className="pending-review-card__action-hint">Apply to live database when you confirm</span>
            </span>
          </label>
          <label className="pending-review-card__action-row">
            <input
              type="checkbox"
              checked={mode === 'schedule'}
              onChange={e => setRowMode(stationId, e.target.checked ? 'schedule' : 'none')}
              disabled={isPublishingAll || isSavingSchedule}
              aria-label={`Schedule: ${stationTitle}`}
            />
            <span className="pending-review-card__action-copy">
              <span className="pending-review-card__action-label">Schedule</span>
              <span className="pending-review-card__action-hint">Include in a timed server job</span>
            </span>
          </label>
        </div>

        {changes.length > 0 ? (
          <details className="pending-review-card__details">
            <summary className="pending-review-card__details-summary">
              <span className="pending-review-card__details-title">Field changes</span>
              <span className="pending-review-card__details-count">{changes.length}</span>
            </summary>
            <div className="pending-review-card__details-body">{renderPendingChangeList(changes, 'card')}</div>
          </details>
        ) : (
          <p className="pending-review-card__empty-changes">No field-level differences to show.</p>
        )}

        <footer className="pending-review-card__footer">
          <Button
            type="button"
            variant="chip"
            width="fill"
            instantAction
            className="pending-review-discard-btn pending-review-card__discard-btn"
            onClick={() => confirmDiscardPendingForStation(stationId, stationTitle)}
            disabled={isPublishingAll || isSavingSchedule}
            ariaLabel={`Discard pending edits for ${stationTitle}`}
          >
            Discard edits
          </Button>
        </footer>
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
      <strong>Publish now</strong> or <strong>Schedule</strong> in the row above. Use <strong>Discard</strong> to remove
      a station from your local pending queue without publishing.
    </p>
  ) : (
    <p className="pending-review-subtitle">
      Use the columns to mark stations for <strong>Publish now</strong> or <strong>Schedule</strong>, then use the
      buttons to confirm. Each station can only be one or the other (or left unchecked to skip for now).{' '}
      <strong>Discard</strong> clears that station&apos;s pending edits locally (not server schedules).
    </p>
  )

  const pendingTabPanelProps =
    layout === 'page' && onPageTabChange && activePageTab === 'pending'
      ? ({
          role: 'tabpanel' as const,
          id: 'review-tab-panel-pending',
          'aria-labelledby': 'review-tab-pending'
        } as const)
      : ({} as const)

  const schedulesTabPanelProps =
    layout === 'page' && onPageTabChange && activePageTab === 'schedules'
      ? ({
          role: 'tabpanel' as const,
          id: 'review-tab-panel-schedules',
          'aria-labelledby': 'review-tab-schedules'
        } as const)
      : ({} as const)

  const introShellClass = renderPageActionBar
    ? 'pending-review-shell__intro'
    : 'pending-review-shell__intro pending-review-shell__intro--with-actions'

  const introAndNotice = (
    <>
      <div className={introShellClass}>
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
              instantAction
              onClick={openPublishModal}
              disabled={actionBarApi.publishDisabled}
            >
              Publish now
            </Button>
            <Button
              type="button"
              variant="wide"
              width="hug"
              instantAction
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
    </>
  )

  const driftBanner = scheduleEditDrift ? (
    <p className="pending-review-schedule-drift" role="status">
      Your local pending queue has changed since this schedule was saved. The run will still apply the snapshot from
      that time — <strong>schedule again</strong> if you need newer edits included in the server job.
    </p>
  ) : null

  const queueTableBlock = (
    <div className="pending-review-shell__main-only">
      <div className="pending-review-toolbar" role="group" aria-label="Select all stations">
        <span className="pending-review-toolbar__label">Set all</span>
        <Button
          type="button"
          variant="chip"
          width="hug"
          instantAction
          onClick={() => setAllRows('publish')}
          disabled={isPublishingAll || isSavingSchedule}
        >
          All publish now
        </Button>
        <Button
          type="button"
          variant="chip"
          width="hug"
          instantAction
          onClick={() => setAllRows('schedule')}
          disabled={isPublishingAll || isSavingSchedule}
        >
          All schedule
        </Button>
        <Button
          type="button"
          variant="chip"
          width="hug"
          instantAction
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
              <th scope="col">Discard</th>
            </tr>
          </thead>
          <tbody>
            {actionablePendingIds.map(stationId => {
              const entry = pendingChanges[stationId]
              if (!entry) return null
              return renderTableRow(stationId, entry)
            })}
          </tbody>
        </table>
      </div>

      <div className="pending-review-cards">
        {actionablePendingIds.map(stationId => {
          const entry = pendingChanges[stationId]
          if (!entry) return null
          return renderCard(stationId, entry)
        })}
      </div>
      {flow.pendingCount === 0 && (
        <p className="pending-review-page-empty-pending" role="status">
          No staged edits. Save changes from the station list to see them here, or open the <strong>Schedules</strong>{' '}
          tab to manage server jobs.
        </p>
      )}
      {flow.pendingCount > 0 && actionablePendingIds.length === 0 && (
        <p className="pending-review-schedule-drift" role="status">
          All current pending rows are already in the active server schedule. Add new edits to see them here.
        </p>
      )}
    </div>
  )

  const showCancelTrackedSchedule =
    Boolean(trackedScheduledJobId) &&
    canMasterPublish &&
    (!serverScheduledJobDetail || serverScheduledJobDetail.status === 'pending')

  const scheduleHistoryChrome = (
    <>
      <div
        className={
          showCancelTrackedSchedule
            ? 'pending-review-shell__intro pending-review-shell__intro--with-actions'
            : 'pending-review-shell__intro'
        }
      >
        <div className="pending-review-shell__intro-text">
          {isPageTabbed ? (
            <h2 className="pending-review-title">Server schedules</h2>
          ) : (
            <h3 className="pending-review-title">Server schedules</h3>
          )}
          <p className="pending-review-subtitle pending-review-schedule-history__legend">
            <strong>Current</strong> = pending or processing. <strong>Cancelled or replaced</strong> = cancelled jobs and
            older snapshots replaced when you merged new stations into a schedule. <strong>Completed or failed</strong> =
            finished server runs. Newest scheduled run time first (up to 80 jobs). Use <strong>Delete</strong> on a
            finished or cancelled row to remove it from history.
          </p>
        </div>
        {showCancelTrackedSchedule ? (
          <div className="pending-review-shell__intro-actions">
            <Button
              type="button"
              variant="wide"
              width="hug"
              instantAction
              onClick={openCancelScheduleModal}
              disabled={isPublishingAll || isSavingSchedule}
            >
              Cancel tracked schedule
            </Button>
          </div>
        ) : null}
      </div>
      {scheduleJobsLoading && (
        <p className="pending-review-schedule-history__state" role="status">
          Loading schedule history…
        </p>
      )}
      {scheduleJobsError && (
        <p className="pending-review-schedule-error" role="alert">
          Could not load schedule list: {scheduleJobsError}. Deploy the Firestore index for{' '}
          <code className="pending-review-inline-code">createdByUid</code> +{' '}
          <code className="pending-review-inline-code">runAt</code> if this persists.
        </p>
      )}
    </>
  )

  const hasScheduleJobRows =
    !scheduleJobsLoading && !scheduleJobsError && scheduleJobRows.length > 0

  const scheduleHistoryLists = (
    <div className="pending-review-shell__main-only">
      {!scheduleJobsLoading && !scheduleJobsError && scheduleJobRows.length === 0 && (
        <p className="pending-review-page-empty-pending" role="status">
          No schedule jobs found for your account.
        </p>
      )}
      {hasScheduleJobRows ? (
        <div className="pending-review-schedule-history__lists-panel">
      {currentScheduleJobs.length > 0 && (
        <div className="pending-review-schedule-history__group">
          <h4 className="pending-review-schedule-history__group-title">Current</h4>
          <ul className="pending-review-schedule-history__list">
            {currentScheduleJobs.map(job => (
              <li
                key={job.id}
                className={
                  trackedScheduledJobId === job.id
                    ? 'pending-review-schedule-history__item pending-review-schedule-history__item--tracked'
                    : 'pending-review-schedule-history__item'
                }
              >
                <div className="pending-review-schedule-history__item-top">
                  <div className="pending-review-schedule-history__item-main">
                    <span className={scheduleJobStatusPillClassName(job)}>{scheduleJobStatusLabel(job)}</span>
                    <span className="pending-review-schedule-history__meta">
                      <strong>{job.stationIds.length}</strong> station{job.stationIds.length === 1 ? '' : 's'} · run at{' '}
                      <strong>{new Date(job.runAtMs).toLocaleString()}</strong>
                      {' · '}
                      {collectionLabelForJob(job.collectionId)}
                    </span>
                    {trackedScheduledJobId === job.id && (
                      <span className="pending-review-schedule-history__badge">Tracked in app</span>
                    )}
                    {job.errorMessage && (
                      <span className="pending-review-schedule-error"> — {job.errorMessage}</span>
                    )}
                  </div>
                    {canMasterPublish && job.status === 'pending' && (
                      <Button
                        type="button"
                        variant="wide"
                        width="hug"
                        instantAction
                        className="pending-review-schedule-history__cancel-job"
                        onClick={() => openCancelScheduleJobModal(job)}
                        disabled={isPublishingAll || isSavingSchedule}
                      >
                        Cancel job
                      </Button>
                    )}
                </div>
                <span className="pending-review-schedule-history__id">Job ID {job.id}</span>
                {job.stationIds.length > 0 && (
                  <details
                    className="pending-review-scheduled-stations"
                    open={job.stationIds.length <= 6}
                  >
                    <summary className="pending-review-scheduled-stations__summary">
                      Stations ({job.stationIds.length})
                    </summary>
                    <ul className="pending-review-scheduled-stations__list">
                      {job.stationIds.map(sid => (
                        <li key={sid} className="pending-review-scheduled-stations__item">
                          <span className="pending-review-scheduled-stations__name">
                            {labelForJobStation(job, sid)}
                          </span>
                          <span className="pending-review-scheduled-stations__id">ID {sid}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cancelledScheduleJobs.length > 0 && (
        <div className="pending-review-schedule-history__group">
          <h4 className="pending-review-schedule-history__group-title">Cancelled or replaced</h4>
          <ul className="pending-review-schedule-history__list pending-review-schedule-history__list--past">
            {cancelledScheduleJobs.map(job => (
              <li key={job.id} className="pending-review-schedule-history__item">
                <div className="pending-review-schedule-history__item-top">
                  <div className="pending-review-schedule-history__item-main">
                    <span className={scheduleJobStatusPillClassName(job)}>{scheduleJobStatusLabel(job)}</span>
                    <span className="pending-review-schedule-history__meta">
                      <strong>{job.stationIds.length}</strong> station{job.stationIds.length === 1 ? '' : 's'} · run at{' '}
                      <strong>{new Date(job.runAtMs).toLocaleString()}</strong>
                      {' · '}
                      {collectionLabelForJob(job.collectionId)}
                    </span>
                  </div>
                  {canMasterPublish && scheduleJobCanDeleteFromHistory(job) && (
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      instantAction
                      className="pending-review-schedule-history__delete-job"
                      ariaLabel={`Delete job ${job.id} from history`}
                      onClick={() => void confirmDeleteScheduleJobHistory(job)}
                      disabled={
                        isPublishingAll || isSavingSchedule || deletingScheduleJobId === job.id
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <p className="pending-review-schedule-cancel-note" role="note">
                  {cancelledScheduleExplanation(job)}
                </p>
                <span className="pending-review-schedule-history__id">Job ID {job.id}</span>
                {job.stationIds.length > 0 && (
                  <details className="pending-review-scheduled-stations">
                    <summary className="pending-review-scheduled-stations__summary">
                      Stations ({job.stationIds.length})
                    </summary>
                    <ul className="pending-review-scheduled-stations__list">
                      {job.stationIds.map(sid => (
                        <li key={sid} className="pending-review-scheduled-stations__item">
                          <span className="pending-review-scheduled-stations__name">
                            {labelForJobStation(job, sid)}
                          </span>
                          <span className="pending-review-scheduled-stations__id">ID {sid}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {finishedScheduleJobs.length > 0 && (
        <div className="pending-review-schedule-history__group">
          <h4 className="pending-review-schedule-history__group-title">Completed or failed</h4>
          <ul className="pending-review-schedule-history__list pending-review-schedule-history__list--past">
            {finishedScheduleJobs.map(job => (
              <li key={job.id} className="pending-review-schedule-history__item">
                <div className="pending-review-schedule-history__item-top">
                  <div className="pending-review-schedule-history__item-main">
                    <span className={scheduleJobStatusPillClassName(job)}>{scheduleJobStatusLabel(job)}</span>
                    <span className="pending-review-schedule-history__meta">
                      <strong>{job.stationIds.length}</strong> station{job.stationIds.length === 1 ? '' : 's'} · run at{' '}
                      <strong>{new Date(job.runAtMs).toLocaleString()}</strong>
                      {' · '}
                      {collectionLabelForJob(job.collectionId)}
                    </span>
                    {job.errorMessage && (
                      <span className="pending-review-schedule-error"> — {job.errorMessage}</span>
                    )}
                  </div>
                  {canMasterPublish && scheduleJobCanDeleteFromHistory(job) && (
                    <Button
                      type="button"
                      variant="wide"
                      width="hug"
                      instantAction
                      className="pending-review-schedule-history__delete-job"
                      ariaLabel={`Delete job ${job.id} from history`}
                      onClick={() => void confirmDeleteScheduleJobHistory(job)}
                      disabled={
                        isPublishingAll || isSavingSchedule || deletingScheduleJobId === job.id
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <span className="pending-review-schedule-history__id">Job ID {job.id}</span>
                {job.stationIds.length > 0 && (
                  <details className="pending-review-scheduled-stations">
                    <summary className="pending-review-scheduled-stations__summary">
                      Stations ({job.stationIds.length})
                    </summary>
                    <ul className="pending-review-scheduled-stations__list">
                      {job.stationIds.map(sid => (
                        <li key={sid} className="pending-review-scheduled-stations__item">
                          <span className="pending-review-scheduled-stations__name">
                            {labelForJobStation(job, sid)}
                          </span>
                          <span className="pending-review-scheduled-stations__id">ID {sid}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      {renderPageActionBar?.(actionBarApi)}
      {isPageTabbed && (
        <div className="review-pending-page__tab-bar-wrap" role="tablist" aria-label="Review sections">
          <ButtonBar
            className="review-pending-page__button-bar"
            buttons={[
              { label: 'Pending changes', value: 'pending', id: 'review-tab-pending' },
              { label: 'Schedules', value: 'schedules', id: 'review-tab-schedules' }
            ]}
            selectedIndex={activePageTab === 'pending' ? 0 : 1}
            onChange={(_, value) => {
              if (value === 'pending') onPageTabChange!('pending')
              if (value === 'schedules') onPageTabChange!('schedules')
            }}
          />
        </div>
      )}
      <section
        className={shellClass}
        aria-label={
          isPageTabbed && activePageTab === 'schedules'
            ? 'Server schedules'
            : 'Review pending station changes before publishing'
        }
      >
        {!isPageTabbed ? (
          <>
            {introAndNotice}
            <section className="pending-review-schedule-history" aria-label="Server schedules for your account">
              {scheduleHistoryChrome}
              {scheduleHistoryLists}
            </section>
            {driftBanner}
            {queueTableBlock}
          </>
        ) : activePageTab === 'pending' ? (
          <div {...pendingTabPanelProps}>
            {introAndNotice}
            {driftBanner}
            {queueTableBlock}
          </div>
        ) : (
          <div {...schedulesTabPanelProps}>
            <section className="pending-review-schedule-history" aria-label="Server schedules for your account">
              {scheduleHistoryChrome}
              {driftBanner}
              {scheduleHistoryLists}
            </section>
          </div>
        )}

        {layout === 'compact' && onBack && (
          <div className="pending-review-actions pending-review-actions--compact-footer">
            <Button
              type="button"
              variant="wide"
              width="fill"
              instantAction
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
          setCancelScheduleTargetJob(null)
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
        cancelScheduleTargetJob={
          cancelScheduleTargetJob
            ? {
                id: cancelScheduleTargetJob.id,
                status: cancelScheduleTargetJob.status,
                runAtMs: cancelScheduleTargetJob.runAtMs,
                stationCount: cancelScheduleTargetJob.stationIds.length
              }
            : null
        }
        onReauthSuccess={completeReauthVerified}
        clearReauthIntent={clearReauthIntent}
      />
    </>
  )
}

export default PendingChangesReviewPanel
