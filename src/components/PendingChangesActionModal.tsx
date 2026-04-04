import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import Button from './Button'
import FirebaseReauthPanel from './FirebaseReauthPanel'
import type { PendingChangeEntry } from '../contexts/PendingStationChangesContext'
import type { ServerScheduledJobDetail } from '../contexts/ScheduledServerJobFirestoreSync'
import { toDatetimeLocalValue } from '../utils/datetimeLocal'
import { PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS } from '../hooks/usePendingChangesPublishFlow'
import './PasswordReauthModal.css'
import './PendingChangesActionModal.css'

export type PendingActionModalMode = 'publish' | 'schedule' | 'cancelSchedule'

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
  prepareScheduleReauth: (ids: string[], runAtMs: number) => void
  prepareCancelScheduleReauth: () => void
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
  onReauthSuccess,
  clearReauthIntent
}) => {
  const [step, setStep] = useState<'summary' | 'verify'>('summary')
  const [verifyKey, setVerifyKey] = useState(0)
  const [modalScheduleDatetime, setModalScheduleDatetime] = useState('')

  useEffect(() => {
    if (!open) {
      setStep('summary')
      clearReauthIntent()
      setModalScheduleDatetime('')
      return
    }
    if (mode === 'schedule') {
      setModalScheduleDatetime(toDatetimeLocalValue(new Date(scheduleLocalNowMs + PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS)))
    }
  }, [open, mode, scheduleLocalNowMs, clearReauthIntent])

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
      if (!Number.isFinite(modalRunAtMs)) {
        window.alert('Enter a valid date and time.')
        return
      }
      if (modalRunAtMs <= Date.now()) {
        window.alert('Pick a time in the future.')
        return
      }
      prepareScheduleReauth(scheduleStationIds, modalRunAtMs)
      setVerifyKey(k => k + 1)
      setStep('verify')
      return
    }
    if (mode === 'cancelSchedule') {
      if (!trackedScheduledJobId) return
      prepareCancelScheduleReauth()
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
                <p className="password-reauth-intro" style={{ marginTop: 0 }}>
                  Nothing runs on the server until you complete verification below. If you already have a scheduled
                  run, saving a new schedule replaces it. Further local edits do not cancel an existing schedule — reschedule
                  if you need the new edits included in the server job.
                </p>
              </>
            )}

            {mode === 'cancelSchedule' && (
              <>
                <p className="pending-action-lead">This will remove the server-side job. Your local pending edits stay.</p>
                {serverScheduledJobDetail && (
                  <p className="password-reauth-intro">
                    Job <strong>{serverScheduledJobDetail.status}</strong>
                    {' · '}
                    run at <strong>{new Date(serverScheduledJobDetail.runAtMs).toLocaleString()}</strong>
                  </p>
                )}
              </>
            )}

            <div className="password-reauth-actions">
              <Button type="button" variant="wide" width="hug" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" variant="wide" width="hug" onClick={goToVerify}>
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
