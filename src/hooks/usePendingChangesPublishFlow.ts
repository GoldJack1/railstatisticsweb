import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Station, SandboxStationDoc } from '../types'
import { useStationCollection } from '../contexts/StationCollectionContext'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import {
  updateStationInFirebase,
  createStationInFirebase,
  mergeStationAdditionalDetailsInFirebase,
  createScheduledStationPublishJob,
  softCancelScheduledStationPublishJobDocument,
  supersedeScheduledStationPublishJobDocument,
  cancelScheduledStationPublishJobDocument,
  deleteScheduledStationPublishJobDocument,
  getScheduledStationPublishJobMergeSource
} from '../services/firebase'
import { writeScheduledPublishAtMs, writeScheduleSavedFingerprint } from '../utils/scheduledPublishStorage'
import { computePendingChangesFingerprint } from '../utils/pendingChangesFingerprint'
import { toDatetimeLocalValue } from '../utils/datetimeLocal'
import { useAuth } from '../contexts/AuthContext'
import { isMasterPublishUser, MASTER_PUBLISH_DENIED_MESSAGE } from '../utils/masterPublishPolicy'

/** When the schedule picker is empty, save uses now + this offset (1 hour). */
export const PENDING_PUBLISH_SCHEDULE_DEFAULT_OFFSET_MS = 60 * 60 * 1000
export type ScheduleSaveMode = 'add' | 'replace'

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
    clearPendingChange,
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
  const pendingScheduleSaveModeRef = useRef<ScheduleSaveMode>('replace')
  const pendingScheduleMergeFromJobIdRef = useRef<string | null>(null)
  const pendingCancelSpecificJobIdRef = useRef<string | null>(null)
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
        await softCancelScheduledStationPublishJobDocument(id, { kind: 'user' })
      } catch (e) {
        console.warn('Could not cancel scheduled job document:', e)
      }
    }
    clearTrackedScheduledServerJob()
    writeScheduledPublishAtMs(null)
    setScheduleDatetimeLocal('')
    setScheduleDatetimeUserEdited(false)
  }, [trackedScheduledJobId, clearTrackedScheduledServerJob, user])

  const cancelScheduledJobById = useCallback(
    async (jobId: string) => {
      if (!isMasterPublishUser(user)) {
        window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
        return
      }
      if (!jobId.trim()) return
      try {
        await cancelScheduledStationPublishJobDocument(jobId)
      } catch (e) {
        console.warn('Could not cancel scheduled job document:', e)
        window.alert(e instanceof Error ? e.message : 'Could not cancel that schedule.')
        return
      }
      if (jobId === trackedScheduledJobId) {
        clearTrackedScheduledServerJob()
        writeScheduledPublishAtMs(null)
        setScheduleDatetimeLocal('')
        setScheduleDatetimeUserEdited(false)
      }
    },
    [trackedScheduledJobId, clearTrackedScheduledServerJob, user]
  )

  const deleteScheduleJobFromHistoryById = useCallback(
    async (jobId: string) => {
      if (!isMasterPublishUser(user)) {
        window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
        return
      }
      if (!jobId.trim()) return
      try {
        await deleteScheduledStationPublishJobDocument(jobId)
      } catch (e) {
        console.warn('Could not delete scheduled job document:', e)
        window.alert(e instanceof Error ? e.message : 'Could not delete that job.')
        return
      }
      if (jobId === trackedScheduledJobId) {
        clearTrackedScheduledServerJob()
        writeScheduledPublishAtMs(null)
        setScheduleDatetimeLocal('')
        setScheduleDatetimeUserEdited(false)
      }
    },
    [trackedScheduledJobId, clearTrackedScheduledServerJob, user]
  )

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
            await softCancelScheduledStationPublishJobDocument(serverJobId, { kind: 'publish' })
          } catch (e) {
            console.warn('Could not cancel scheduled job after manual publish:', e)
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
    async (
      ms: number,
      stationIds: string[],
      saveMode: ScheduleSaveMode = 'replace',
      mergeFromJobId: string | null = null
    ) => {
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

        let basePayload: Record<
          string,
          { isNew?: boolean; updated: Partial<Station>; sandboxUpdated?: Partial<SandboxStationDoc> | null }
        > = {}
        let effectiveRunAtMs = ms

        if (saveMode === 'add') {
          if (mergeFromJobId) {
            const src = await getScheduledStationPublishJobMergeSource(mergeFromJobId)
            if (!src) {
              window.alert('Could not load that schedule from the server. Try again or pick Create new.')
              return
            }
            basePayload = { ...src.changes } as Record<
              string,
              { isNew?: boolean; updated: Partial<Station>; sandboxUpdated?: Partial<SandboxStationDoc> | null }
            >
            effectiveRunAtMs = src.runAtMs
          } else if (
            previousId &&
            serverScheduledJobDetail?.scheduledChanges &&
            typeof serverScheduledJobDetail.scheduledChanges === 'object'
          ) {
            basePayload = { ...serverScheduledJobDetail.scheduledChanges } as Record<
              string,
              { isNew?: boolean; updated: Partial<Station>; sandboxUpdated?: Partial<SandboxStationDoc> | null }
            >
            effectiveRunAtMs = serverScheduledJobDetail.runAtMs
          } else {
            window.alert('No schedule selected to add to.')
            return
          }
        }

        const changesPayload: Record<
          string,
          { isNew?: boolean; updated: Partial<Station>; sandboxUpdated?: Partial<SandboxStationDoc> | null }
        > = {
          ...basePayload
        }
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
          runAtMs: effectiveRunAtMs,
          collectionId,
          changes: changesPayload
        })
        registerScheduledServerJob(jobId)

        // Only supersede when merging into an existing pending job (same run time, expanded station list).
        // "Create new schedule" (replace) must leave other pending jobs alone so multiple schedules can run.
        const jobToDelete = saveMode === 'add' ? mergeFromJobId ?? previousId ?? null : null
        if (jobToDelete && jobToDelete !== jobId) {
          await supersedeScheduledStationPublishJobDocument(jobToDelete, jobId)
        }
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
      pendingChanges,
      collectionId,
      registerScheduledServerJob,
      serverScheduledJobDetail?.scheduledChanges,
      serverScheduledJobDetail?.runAtMs,
      user
    ]
  )

  const preparePublishReauth = useCallback((stationIds: string[]) => {
    pendingScheduleMsRef.current = null
    pendingScheduleStationIdsRef.current = null
    pendingPublishStationIdsRef.current = stationIds
    passwordReauthActionRef.current = 'publish'
  }, [])

  const prepareScheduleReauth = useCallback(
    (stationIds: string[], runAtMs: number, mode: ScheduleSaveMode, mergeFromJobId: string | null) => {
      pendingPublishStationIdsRef.current = null
      pendingScheduleStationIdsRef.current = stationIds
      pendingScheduleMsRef.current = runAtMs
      pendingScheduleSaveModeRef.current = mode
      pendingScheduleMergeFromJobIdRef.current = mergeFromJobId
      passwordReauthActionRef.current = 'schedule'
    },
    []
  )

  const prepareCancelScheduleReauth = useCallback((specificJobId?: string | null) => {
    pendingPublishStationIdsRef.current = null
    pendingScheduleMsRef.current = null
    pendingScheduleStationIdsRef.current = null
    pendingScheduleSaveModeRef.current = 'replace'
    pendingScheduleMergeFromJobIdRef.current = null
    pendingCancelSpecificJobIdRef.current =
      typeof specificJobId === 'string' && specificJobId.trim() !== '' ? specificJobId : null
    passwordReauthActionRef.current = 'cancelSchedule'
  }, [])

  const completeReauthVerified = useCallback(() => {
    if (!isMasterPublishUser(user)) {
      window.alert(MASTER_PUBLISH_DENIED_MESSAGE)
      passwordReauthActionRef.current = null
      pendingScheduleMsRef.current = null
      pendingPublishStationIdsRef.current = null
      pendingScheduleStationIdsRef.current = null
      pendingScheduleMergeFromJobIdRef.current = null
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
      const mergeFrom = pendingScheduleMergeFromJobIdRef.current
      pendingScheduleMsRef.current = null
      pendingScheduleStationIdsRef.current = null
      pendingScheduleMergeFromJobIdRef.current = null
      const mode = pendingScheduleSaveModeRef.current
      pendingScheduleSaveModeRef.current = 'replace'
      if (ms != null && ids && ids.length > 0) void executeSaveSchedule(ms, ids, mode, mergeFrom)
      return
    }
    if (action === 'cancelSchedule') {
      const specific = pendingCancelSpecificJobIdRef.current
      pendingCancelSpecificJobIdRef.current = null
      if (specific) {
        void cancelScheduledJobById(specific)
      } else {
        void clearScheduledPublish()
      }
    }
  }, [runPublishImmediateForIds, executeSaveSchedule, clearScheduledPublish, cancelScheduledJobById, user])

  const clearReauthIntent = useCallback(() => {
    passwordReauthActionRef.current = null
    pendingScheduleMsRef.current = null
    pendingPublishStationIdsRef.current = null
    pendingScheduleStationIdsRef.current = null
    pendingScheduleSaveModeRef.current = 'replace'
    pendingScheduleMergeFromJobIdRef.current = null
    pendingCancelSpecificJobIdRef.current = null
  }, [])

  return {
    user,
    pendingChanges,
    clearPendingChange,
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
    deleteScheduleJobFromHistoryById,
    completeReauthVerified,
    clearReauthIntent
  }
}
