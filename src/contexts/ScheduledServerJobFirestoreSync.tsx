import React, { useEffect, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import {
  initializeFirebase,
  getFirebaseDB,
  SCHEDULED_STATION_PUBLISH_JOBS_COLLECTION
} from '../services/firebase'

export interface ServerScheduledJobDetail {
  jobId: string
  runAtMs: number
  status: string
  errorMessage?: string
}

interface ScheduledServerJobFirestoreSyncProps {
  jobId: string | null
  onDetail: (detail: ServerScheduledJobDetail | null) => void
  onCompleted: (stationIds: string[]) => void
  onJobDocMissing: () => void
}

/**
 * Subscribes to the active scheduled publish job; clears local pending + storage when status becomes completed.
 */
const ScheduledServerJobFirestoreSync: React.FC<ScheduledServerJobFirestoreSyncProps> = ({
  jobId,
  onDetail,
  onCompleted,
  onJobDocMissing
}) => {
  const onDetailRef = useRef(onDetail)
  const onCompletedRef = useRef(onCompleted)
  const onJobDocMissingRef = useRef(onJobDocMissing)
  onDetailRef.current = onDetail
  onCompletedRef.current = onCompleted
  onJobDocMissingRef.current = onJobDocMissing

  useEffect(() => {
    if (!jobId) {
      onDetailRef.current(null)
      return
    }

    let unsub: (() => void) | undefined

    void initializeFirebase().then(() => {
      const database = getFirebaseDB()
      if (!database) return

      const ref = doc(database, SCHEDULED_STATION_PUBLISH_JOBS_COLLECTION, jobId)
      unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            onJobDocMissingRef.current()
            return
          }
          const d = snap.data()
          const status = String(d.status ?? '')
          const runAt = d.runAt as { toMillis?: () => number } | undefined
          const runAtMs = typeof runAt?.toMillis === 'function' ? runAt.toMillis() : 0
          onDetailRef.current({
            jobId,
            runAtMs,
            status,
            errorMessage: typeof d.errorMessage === 'string' ? d.errorMessage : undefined
          })

          if (status === 'completed') {
            const raw = d.stationIds
            const stationIds = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
            onCompletedRef.current(stationIds)
          }
        },
        (err) => {
          console.error('Scheduled publish job listener error:', err)
        }
      )
    })

    return () => {
      if (unsub) unsub()
    }
  }, [jobId])

  return null
}

export default ScheduledServerJobFirestoreSync
