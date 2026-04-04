import { useEffect, useState } from 'react'
import {
  subscribeMyScheduleJobsForUser,
  type PendingScheduleJobSummary
} from '../services/firebase'

/**
 * Live Firestore subscription: this user’s scheduled publish jobs (all statuses), newest runAt first.
 */
export function useMyScheduleJobsForReview(uid: string | undefined, enabled: boolean) {
  const [rows, setRows] = useState<PendingScheduleJobSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !uid) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const unsub = subscribeMyScheduleJobsForUser(
      uid,
      next => {
        setRows(next)
        setLoading(false)
      },
      err => {
        setError(err.message)
        setLoading(false)
      }
    )

    return unsub
  }, [uid, enabled])

  return { rows, loading, error }
}
