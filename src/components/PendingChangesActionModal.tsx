import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import Button from './Button'
import FirebaseReauthPanel from './FirebaseReauthPanel'
import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { ServerScheduledJobDetail } from '../contexts/ScheduledServerJobFirestoreSync'
import { toDatetimeLocalValue } from '../utils/datetimeLocal'
import {
  PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS,
  type ScheduleSaveMode
} from '../hooks/usePendingChangesPublishFlow'
import { fetchMyPendingScheduleJobs, type PendingScheduleJobSummary } from '../services/firebase'
import './PasswordReauthModal.css'
import './PendingChangesActionModal.css'

export type PendingActionModalMode = 'publish' | 'schedule' | 'cancelSchedule'

/** When cancelling a specific job from the schedule list (not only the app-tracked job). */
export type CancelScheduleTargetJob = {
  id: string
  status: string
  runAtMs: number
  stationCount: number
}

/** `null` = nothing selected yet; `'new'` = create new job; else Firestore job id to merge into. */
export type ScheduleTargetSelection = 'new' | string | null

export interface PendingChangesActionModalProps {
  open: boolean
  mode: PendingActionModalMode
  onClose: () => void
  user: User | null
  publishStationIds: string[]
  scheduleStationIds: string[]
  pendingChanges: Record<string, PendingChangeEntry>
  trackedScheduledJobId: string | null
  serverScheduledJobDetail: ServerScheduledJobDetail | null
  scheduleLocalNowMs: number
  preparePublishReauth: (ids: string[]) => void
  prepareScheduleReauth: (
    ids: string[],
    runAtMs: number,
    mode: ScheduleSaveMode,
    mergeFromJobId: string | null
  ) => void
  prepareCancelScheduleReauth: (specificJobId?: string | null) => void
  /** Set when opening cancel flow for one list row; `null` = cancel the app-tracked job only. */
  cancelScheduleTargetJob: CancelScheduleTargetJob | null
  onReauthSuccess: () => void
  clearReauthIntent: () => void
}

const stationLabel = (entry: PendingChangeEntry | undefined, id: string): string =>
  entry?.original.stationName?.trim() || `ID ${id}`

const PendingChangesActionModal: React.FC<PendingChangesActionModalProps> = ({
  open,
  mode,
  onClose,
  user,
  publishStationIds,
  scheduleStationIds,
  pendingChanges,
  trackedScheduledJobId,
  serverScheduledJobDetail,
  scheduleLocalNowMs,
  preparePublishReauth,
  prepareScheduleReauth,
  prepareCancelScheduleReauth,
  cancelScheduleTargetJob,
  onReauthSuccess,
  clearReauthIntent
}) => {
  const scheduleTargetGroupId = useId()
  const [step, setStep] = useState<'summary' | 'verify'>('summary')
  const [verifyKey, setVerifyKey] = useState(0)
  const [modalScheduleDatetime, setModalScheduleDatetime] = useState('')
  const [selectedScheduleTarget, setSelectedScheduleTarget] = useState<ScheduleTargetSelection>(null)
  const [scheduleJobRows, setScheduleJobRows] = useState<PendingScheduleJobSummary[]>([])
  const [scheduleJobsLoading, setScheduleJobsLoading] = useState(false)
  const scheduleModalWasOpenRef = useRef(false)
  /** Tracks last schedule radio so we only reset datetime when switching *to* Create new (not every tick). */
  const schedulePickerPrevRef = useRef<ScheduleTargetSelection>(null)

  useEffect(() => {
    if (!open) {
      setStep('summary')
      clearReauthIntent()
      setModalScheduleDatetime('')
      setSelectedScheduleTarget(null)
      setScheduleJobRows([])
      setScheduleJobsLoading(false)
      scheduleModalWasOpenRef.current = false
      schedulePickerPrevRef.current = null
      return
    }

    const justOpened = !scheduleModalWasOpenRef.current
    scheduleModalWasOpenRef.current = true

    if (!justOpened || mode !== 'schedule') {
      return
    }

    // Default run time is always local now + 1h — not the previous / tracked job's runAt (Create new should feel fresh).
    const defaultRunAtMs = scheduleLocalNowMs + PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS
    setModalScheduleDatetime(toDatetimeLocalValue(new Date(defaultRunAtMs)))
    setSelectedScheduleTarget(null)
    schedulePickerPrevRef.current = null

    const uid = user?.uid
    if (!uid) {
      setScheduleJobRows([])
      setScheduleJobsLoading(false)
      return
    }

    setScheduleJobsLoading(true)
    let cancelled = false

    void fetchMyPendingScheduleJobs(uid)
      .then(rows => {
        if (cancelled) return
        const list = [...rows]
        if (
          trackedScheduledJobId &&
          serverScheduledJobDetail &&
          !list.some(r => r.id === trackedScheduledJobId)
        ) {
          list.push({
            id: trackedScheduledJobId,
            runAtMs: serverScheduledJobDetail.runAtMs,
            status: serverScheduledJobDetail.status,
            stationIds: [...serverScheduledJobDetail.stationIds],
            stationLabels: { ...serverScheduledJobDetail.stationLabels }
          })
        }
        list.sort((a, b) => a.runAtMs - b.runAtMs)
        setScheduleJobRows(list)
      })
      .catch(() => {
        if (!cancelled) setScheduleJobRows([])
      })
      .finally(() => {
        if (!cancelled) setScheduleJobsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    open,
    mode,
    scheduleLocalNowMs,
    clearReauthIntent,
    serverScheduledJobDetail,
    trackedScheduledJobId,
    user?.uid
  ])

  useEffect(() => {
    if (!open || mode !== 'schedule') return
    if (selectedScheduleTarget !== 'new') {
      schedulePickerPrevRef.current = selectedScheduleTarget
      return
    }
    const prev = schedulePickerPrevRef.current
    schedulePickerPrevRef.current = 'new'
    if (prev === 'new') return
    setModalScheduleDatetime(
      toDatetimeLocalValue(new Date(Date.now() + PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS))
    )
  }, [open, mode, selectedScheduleTarget])

  const handleClose = useCallback(() => {
    clearReauthIntent()
    onClose()
  }, [clearReauthIntent, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  const modalRunAtMs = useMemo(() => {
    const raw = modalScheduleDatetime.trim()
    if (!raw) return scheduleLocalNowMs + PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS
    const t = new Date(raw).getTime()
    return Number.isFinite(t) ? t : NaN
  }, [modalScheduleDatetime, scheduleLocalNowMs])

  const selectedJobRow = useMemo(
    () =>
      selectedScheduleTarget && selectedScheduleTarget !== 'new'
        ? scheduleJobRows.find(j => j.id === selectedScheduleTarget)
        : undefined,
    [scheduleJobRows, selectedScheduleTarget]
  )

  const goToVerify = () => {
    if (mode === 'publish') {
      if (publishStationIds.length === 0) return
      preparePublishReauth(publishStationIds)
      setVerifyKey(k => k + 1)
      setStep('verify')
      return
    }
    if (mode === 'schedule') {
      if (scheduleStationIds.length === 0) return
      if (selectedScheduleTarget === null) {
        window.alert('Choose one of the schedule options below.')
        return
      }
      if (selectedScheduleTarget === 'new') {
        if (!Number.isFinite(modalRunAtMs)) {
          window.alert('Enter a valid date and time.')
          return
        }
        if (modalRunAtMs <= Date.now()) {
          window.alert('Pick a time in the future.')
          return
        }
        prepareScheduleReauth(scheduleStationIds, modalRunAtMs, 'replace', null)
      } else {
        prepareScheduleReauth(scheduleStationIds, 0, 'add', selectedScheduleTarget)
      }
      setVerifyKey(k => k + 1)
      setStep('verify')
      return
    }
    if (mode === 'cancelSchedule') {
      if (cancelScheduleTargetJob) {
        prepareCancelScheduleReauth(cancelScheduleTargetJob.id)
      } else {
        if (!trackedScheduledJobId) return
        prepareCancelScheduleReauth()
      }
      setVerifyKey(k => k + 1)
      setStep('verify')
    }
  }

  const handleVerified = () => {
    onReauthSuccess()
    handleClose()
  }

  if (!open || !user) return null

  const title =
    mode === 'publish'
      ? 'Publish now'
      : mode === 'schedule'
        ? 'Schedule publish'
        : 'Cancel scheduled publish'

  return (
    <div className="password-reauth-overlay pending-action-overlay" role="presentation" onClick={handleClose}>
      <div
        className="password-reauth-dialog pending-action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-action-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="pending-action-title" className="password-reauth-title">
          {title}
        </h2>

        {step === 'summary' && (
          <>
            {mode === 'publish' && (
              <>
                <p className="pending-action-lead">These stations will be written to the database immediately:</p>
                <ul className="pending-action-station-list">
                  {publishStationIds.map(id => (
                    <li key={id}>{stationLabel(pendingChanges[id], id)}</li>
                  ))}
                </ul>
                {trackedScheduledJobId && (
                  <p className="pending-action-warn" role="status">
                    You have an active server schedule. Publishing will change your pending queue and that schedule will be
                    cancelled until you save a new one.
                  </p>
                )}
              </>
            )}

            {mode === 'schedule' && (
              <>
                <p className="pending-action-lead">Stations to include in the server job:</p>
                <ul className="pending-action-station-list">
                  {scheduleStationIds.map(id => (
                    <li key={id}>{stationLabel(pendingChanges[id], id)}</li>
                  ))}
                </ul>

                <fieldset className="pending-action-schedule-fieldset">
                  <legend className="pending-action-fieldset-legend">Choose a schedule</legend>
                  {scheduleJobsLoading && (
                    <p className="password-reauth-intro pending-action-loading">Loading your pending schedules…</p>
                  )}
                  {!scheduleJobsLoading &&
                    scheduleJobRows.map(job => (
                      <label key={job.id} className="pending-action-radio-row">
                        <input
                          type="radio"
                          name={scheduleTargetGroupId}
                          value={job.id}
                          checked={selectedScheduleTarget === job.id}
                          onChange={() => setSelectedScheduleTarget(job.id)}
                        />
                        <span className="pending-action-radio-body">
                          <span className="pending-action-radio-title">
                            Add to this schedule — {job.stationIds.length} station
                            {job.stationIds.length === 1 ? '' : 's'}
                          </span>
                          <span className="pending-action-radio-meta">
                            Runs at {new Date(job.runAtMs).toLocaleString()}
                            {job.status ? ` · ${job.status}` : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  <label className="pending-action-radio-row">
                    <input
                      type="radio"
                      name={scheduleTargetGroupId}
                      value="new"
                      checked={selectedScheduleTarget === 'new'}
                      onChange={() => setSelectedScheduleTarget('new')}
                    />
                    <span className="pending-action-radio-body">
                      <span className="pending-action-radio-title">Create new schedule</span>
                      <span className="pending-action-radio-meta">
                        Pick a new run time. Other pending server schedules stay active; the app will track this new job.
                        Cancel old jobs from the Schedules tab if you no longer need them.
                      </span>
                    </span>
                  </label>
                </fieldset>

                {selectedScheduleTarget === null && (
                  <p className="pending-action-choice-hint" role="status">
                    Select a radio option above before continuing.
                  </p>
                )}

                {selectedJobRow && (
                  <details
                    className="pending-action-existing-list"
                    open={selectedJobRow.stationIds.length <= 8}
                  >
                    <summary>
                      Stations already in this schedule ({selectedJobRow.stationIds.length})
                    </summary>
                    <ul className="pending-action-station-list pending-action-station-list--compact">
                      {selectedJobRow.stationIds.map(id => (
                        <li key={id}>
                          {selectedJobRow.stationLabels[id]?.trim() || stationLabel(pendingChanges[id], id)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {selectedScheduleTarget === 'new' && (
                  <>
                    <p className="password-reauth-intro">
                      Your time: <strong>{new Date(scheduleLocalNowMs).toLocaleString()}</strong>
                    </p>
                    <p className="password-reauth-intro">
                      {Number.isFinite(modalRunAtMs) ? (
                        <>
                          Will publish at: <strong>{new Date(modalRunAtMs).toLocaleString()}</strong>
                        </>
                      ) : (
                        <span className="password-reauth-error">Enter a valid date and time.</span>
                      )}
                    </p>
                    <label className="password-reauth-label" htmlFor="pending-action-schedule-dt">
                      Date &amp; time
                    </label>
                    <input
                      id="pending-action-schedule-dt"
                      type="datetime-local"
                      className="password-reauth-input"
                      min={toDatetimeLocalValue(new Date(scheduleLocalNowMs))}
                      value={modalScheduleDatetime}
                      onChange={e => setModalScheduleDatetime(e.target.value)}
                    />
                  </>
                )}

                <p className="password-reauth-intro" style={{ marginTop: 0 }}>
                  Nothing runs on the server until you complete verification below.
                  {selectedScheduleTarget !== null && selectedScheduleTarget !== 'new' && (
                    <>
                      {' '}
                      The selected job keeps its run time; your stations are merged into it.
                    </>
                  )}
                  {selectedScheduleTarget === 'new' && <> Use a future date and time for the new job.</>}
                </p>
              </>
            )}

            {mode === 'cancelSchedule' && (
              <>
                <p className="pending-action-lead">
                  This will mark the server job as <strong>cancelled</strong> (it stays in your history). Your local
                  pending edits stay.
                </p>
                {(cancelScheduleTargetJob || serverScheduledJobDetail) && (
                  <p className="password-reauth-intro">
                    Job{' '}
                    <strong>{cancelScheduleTargetJob?.status ?? serverScheduledJobDetail?.status}</strong>
                    {' · '}
                    {cancelScheduleTargetJob ? (
                      <>
                        <strong>{cancelScheduleTargetJob.stationCount}</strong> station
                        {cancelScheduleTargetJob.stationCount === 1 ? '' : 's'} · run at{' '}
                        <strong>{new Date(cancelScheduleTargetJob.runAtMs).toLocaleString()}</strong>
                      </>
                    ) : (
                      serverScheduledJobDetail && (
                        <>
                          run at{' '}
                          <strong>{new Date(serverScheduledJobDetail.runAtMs).toLocaleString()}</strong>
                        </>
                      )
                    )}
                  </p>
                )}
              </>
            )}

            <div className="password-reauth-actions">
              <Button type="button" variant="wide" width="hug" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="wide"
                width="hug"
                onClick={goToVerify}
                disabled={
                  (mode === 'schedule' && selectedScheduleTarget === null) ||
                  (mode === 'cancelSchedule' && !cancelScheduleTargetJob && !trackedScheduledJobId)
                }
              >
                Continue to verify
              </Button>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <FirebaseReauthPanel
              key={verifyKey}
              user={user}
              title="Verify it’s you"
              titleHeading="h3"
              onVerified={handleVerified}
              onCancel={() => {
                clearReauthIntent()
                setStep('summary')
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default PendingChangesActionModal
