import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Station, SandboxStationDoc } from '../types'
import { useStationCollection } from '../contexts/StationCollectionContext'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import {
  updateStationInFirebase,
  createStationInFirebase,
  mergeStationAdditionalDetailsInFirebase,
  createScheduledStationPublishJob,
  deleteScheduledStationPublishJobDocument
} from '../services/firebase'
import { writeScheduledPublishAtMs, writeScheduleSavedFingerprint } from '../utils/scheduledPublishStorage'
import { computePendingChangesFingerprint } from '../utils/pendingChangesFingerprint'
import { toDatetimeLocalValue } from '../utils/datetimeLocal'
import { useAuth } from '../contexts/AuthContext'
import { isMasterPublishUser, MASTER_PUBLISH_DENIED_MESSAGE } from '../utils/masterPublishPolicy'

/** When the schedule picker is empty, save uses now + this offset (1 hour). */
export const PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS = 60 * 60 * 1000

export interface UsePendingChangesPublishFlowOptions {
  refetch: () => void | Promise<void>
  reviewActive: boolean
  onPublishSuccess?: () => void
}

export function usePendingChangesPublishFlow({
  refetch,
  reviewActive,
  onPublishSuccess
}: UsePendingChangesPublishFlowOptions) {
  const { user } = useAuth()
  const { collectionId } = useStationCollection()
  const {
    pendingChanges,
    clearPendingChangesForIds,
    trackedScheduledJobId,
    registerScheduledServerJob,
    clearTrackedScheduledServerJob,
    serverScheduledJobDetail
  } = usePendingStationChanges()

  const passwordReauthActionRef = useRef<'publish' | 'schedule' | 'cancelSchedule' | null>(null)
  const pendingScheduleMsRef = useRef<number | null>(null)
  const pendingPublishStationIdsRef = useRef<string[] | null>(null)
  const pendingScheduleStationIdsRef = useRef<string[] | null>(null)
  const [isPublishingAll, setIsPublishingAll] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [scheduleDatetimeLocal, setScheduleDatetimeLocal] = useState('')
  const [scheduleDatetimeUserEdited, setScheduleDatetimeUserEdited] = useState(false)
  const [scheduleLocalNowMs, setScheduleLocalNowMs] = useState(() => Date.now())

  const pendingCount = Object.keys(pendingChanges).length
  const canMasterPublish = isMasterPublishUser(user)

  useEffect(() => {
    if (!reviewActive) setScheduleDatetimeUserEdited(false)
  }, [reviewActive])

  useEffect(() => {
    if (!reviewActive) return
    const id = window.setInterval(() => setScheduleLocalNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [reviewActive])

  const scheduleRunAtPreviewMs = useMemo(() => {
    const raw = scheduleDatetimeLocal.trim()
    if (!raw) return scheduleLocalNowMs + PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS
    const t = new Date(raw).getTime()
    return Number.isFinite(t) ? t : NaN
  }, [scheduleDatetimeLocal, scheduleLocalNowMs])

  const clearScheduledPublish = useCallback(async () => {
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      return
    }
    const id = trackedScheduledJobId
    if (id) {
      try {
        await deleteScheduledStationPublishJobDocument(id)
      } catch (e) {
        console.warn('Could not delete scheduled job document:', e)
      }
    }
    clearTrackedScheduledServerJob()
    writeScheduledPublishAtMs(null)
    setScheduleDatetimeLocal('')
    setScheduleDatetimeUserEdited(false)
  }, [trackedScheduledJobId, clearTrackedScheduledServerJob, user])

  const runPublishImmediateForIds = useCallback(
    async (stationIds: string[]) => {
      if (!isMasterPublishUser(user)) {
        window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
        return
      }
      const want = new Set(stationIds)
      const validIds = Object.keys(pendingChanges).filter(id => want.has(id))
      if (validIds.length === 0) return

      setIsPublishingAll(true)
      try {
        for (const stationId of validIds) {
          const entry = pendingChanges[stationId]
          if (!entry) continue
          if (entry.isNew) {
            await createStationInFirebase(stationId, entry.updated)
            if (entry.sandboxUpdated && Object.keys(entry.sandboxUpdated).length > 0) {
              await mergeStationAdditionalDetailsInFirebase(stationId, entry.sandboxUpdated)
            }
          } else {
            await updateStationInFirebase(stationId, entry.updated)
            if (entry.sandboxUpdated && Object.keys(entry.sandboxUpdated).length > 0) {
              await mergeStationAdditionalDetailsInFirebase(stationId, entry.sandboxUpdated)
            }
          }
        }

        const clearsAllPending = validIds.length === Object.keys(pendingChanges).length
        const serverJobId = trackedScheduledJobId

        clearPendingChangesForIds(validIds)

        if (clearsAllPending && serverJobId) {
          try {
            await deleteScheduledStationPublishJobDocument(serverJobId)
          } catch (e) {
            console.warn('Could not delete scheduled job after manual publish:', e)
          }
        }
        if (clearsAllPending) {
          clearTrackedScheduledServerJob()
          writeScheduledPublishAtMs(null)
          setScheduleDatetimeLocal('')
          setScheduleDatetimeUserEdited(false)
        }

        await refetch()
        if (clearsAllPending) {
          onPublishSuccess?.()
        }
      } finally {
        setIsPublishingAll(false)
      }
    },
    [
      pendingChanges,
      clearPendingChangesForIds,
      trackedScheduledJobId,
      clearTrackedScheduledServerJob,
      refetch,
      user,
      onPublishSuccess
    ]
  )

  useEffect(() => {
    if (!trackedScheduledJobId || !serverScheduledJobDetail?.runAtMs) return
    setScheduleDatetimeLocal(toDatetimeLocalValue(new Date(serverScheduledJobDetail.runAtMs)))
    setScheduleDatetimeUserEdited(false)
  }, [trackedScheduledJobId, serverScheduledJobDetail?.runAtMs])

  const executeSaveSchedule = useCallback(
    async (ms: number, stationIds: string[]) => {
      if (!isMasterPublishUser(user)) {
        window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
        return
      }
      const want = new Set(stationIds)
      const validIds = Object.keys(pendingChanges).filter(id => want.has(id))
      if (validIds.length === 0) {
        window.alert('No valid stations selected for scheduling.')
        return
      }

      setIsSavingSchedule(true)
      try {
        const previousId = trackedScheduledJobId
        if (previousId) {
          try {
            await deleteScheduledStationPublishJobDocument(previousId)
          } catch {
            /* previous job may already be processed or missing */
          }
          clearTrackedScheduledServerJob()
        }

        const changesPayload: Record<
          string,
          { isNew?: boolean; updated: Partial<Station>; sandboxUpdated?: Partial<SandboxStationDoc> | null }
        > = {}
        for (const stationId of validIds) {
          const entry = pendingChanges[stationId]
          if (!entry) continue
          changesPayload[stationId] = {
            isNew: entry.isNew,
            updated: entry.updated,
            sandboxUpdated: entry.sandboxUpdated ?? null
          }
        }

        const jobId = await createScheduledStationPublishJob({
          runAtMs: ms,
          collectionId,
          changes: changesPayload
        })
        registerScheduledServerJob(jobId)
        writeScheduleSavedFingerprint(computePendingChangesFingerprint(pendingChanges))
        writeScheduledPublishAtMs(null)
        setScheduleDatetimeUserEdited(false)
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Failed to save schedule to the server.')
      } finally {
        setIsSavingSchedule(false)
      }
    },
    [
      trackedScheduledJobId,
      clearTrackedScheduledServerJob,
      pendingChanges,
      collectionId,
      registerScheduledServerJob,
      user
    ]
  )

  const preparePublishReauth = useCallback((stationIds: string[]) => {
    pendingScheduleMsRef.current = null
    pendingScheduleStationIdsRef.current = null
    pendingPublishStationIdsRef.current = stationIds
    passwordReauthActionRef.current = 'publish'
  }, [])

  const prepareScheduleReauth = useCallback((stationIds: string[], runAtMs: number) => {
    pendingPublishStationIdsRef.current = null
    pendingScheduleStationIdsRef.current = stationIds
    pendingScheduleMsRef.current = runAtMs
    passwordReauthActionRef.current = 'schedule'
  }, [])

  const prepareCancelScheduleReauth = useCallback(() => {
    pendingPublishStationIdsRef.current = null
    pendingScheduleMsRef.current = null
    pendingScheduleStationIdsRef.current = null
    passwordReauthActionRef.current = 'cancelSchedule'
  }, [])

  const completeReauthVerified = useCallback(() => {
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      passwordReauthActionRef.current = null
      pendingScheduleMsRef.current = null
      pendingPublishStationIdsRef.current = null
      pendingScheduleStationIdsRef.current = null
      return
    }
    const action = passwordReauthActionRef.current
    passwordReauthActionRef.current = null
    if (action === 'publish') {
      const ids = pendingPublishStationIdsRef.current
      pendingPublishStationIdsRef.current = null
      if (ids && ids.length > 0) void runPublishImmediateForIds(ids)
      return
    }
    if (action === 'schedule') {
      const ms = pendingScheduleMsRef.current
      const ids = pendingScheduleStationIdsRef.current
      pendingScheduleMsRef.current = null
      pendingScheduleStationIdsRef.current = null
      if (ms != null && ids && ids.length > 0) void executeSaveSchedule(ms, ids)
      return
    }
    if (action === 'cancelSchedule') {
      void clearScheduledPublish()
    }
  }, [runPublishImmediateForIds, executeSaveSchedule, clearScheduledPublish, user])

  const clearReauthIntent = useCallback(() => {
    passwordReauthActionRef.current = null
    pendingScheduleMsRef.current = null
    pendingPublishStationIdsRef.current = null
    pendingScheduleStationIdsRef.current = null
  }, [])

  return {
    user,
    pendingChanges,
    pendingCount,
    canMasterPublish,
    isPublishingAll,
    isSavingSchedule,
    scheduleDatetimeLocal,
    setScheduleDatetimeLocal,
    scheduleDatetimeUserEdited,
    setScheduleDatetimeUserEdited,
    scheduleLocalNowMs,
    scheduleRunAtPreviewMs,
    trackedScheduledJobId,
    serverScheduledJobDetail,
    preparePublishReauth,
    prepareScheduleReauth,
    prepareCancelScheduleReauth,
    completeReauthVerified,
    clearReauthIntent
  }
}
