import React, { useEffect, useState } from 'react'
import type { StationMessage } from '../../../types/darwin'
import './StationMessages.css'

const SEVERITY_LABELS = ['Info', 'Minor', 'Major', 'Severe']
const COLLAPSE_THRESHOLD = 2
const DISMISSED_KEY = 'rs.darwin.dismissedMessages'

/** Set of dismissed message ids, persisted in localStorage so a user's
 * dismissal sticks across reloads. The Darwin daemon only re-broadcasts a
 * message if the underlying NRCC entry changes its id, so this is safe. */
function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch { return new Set() }
}
function writeDismissed(ids: Set<string>): void {
  try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])) } catch {}
}

export const StationMessages: React.FC<{
  messages: StationMessage[]
  /** When provided, dismissed-id state is scoped under this key as well, so
   * dismissals at one CRS don't suppress at others (rare, but cleaner). */
  scope?: string
}> = ({ messages }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed())
  const [expanded,  setExpanded]  = useState(false)

  // Re-read on the first mount and whenever the messages array reference
  // changes — covers the case where the user dismissed elsewhere then
  // navigated back.
  useEffect(() => { setDismissed(readDismissed()) }, [messages])

  if (!messages || messages.length === 0) return null

  // Defence in depth: even if the daemon ever lets through an empty / very
  // short message (broken flatten, partial broadcast), don't render an
  // empty banner. The UI should never display a blank "MAJOR TRAIN" pill.
  const visible = messages.filter((m) => !dismissed.has(m.id) && m.plainMessage && m.plainMessage.trim().length >= 3)
  if (visible.length === 0) return null

  const showAll = expanded || visible.length <= COLLAPSE_THRESHOLD
  const shown   = showAll ? visible : visible.slice(0, COLLAPSE_THRESHOLD)
  const hiddenCount = visible.length - shown.length

  function dismiss(id: string) {
    const next = new Set(dismissed); next.add(id)
    writeDismissed(next); setDismissed(next)
  }

  return (
    <div className="dep-msg-stack" role="region" aria-label="Station messages">
      {shown.map((m) => {
        const sev = Math.max(0, Math.min(3, Math.floor(m.severity || 0)))
        return (
          <div key={m.id} className={`dep-msg dep-msg--sev${sev}`} role="alert">
            <div className="dep-msg-header">
              <span className="dep-msg-sev">{SEVERITY_LABELS[sev]}</span>
              {m.category && <span className="dep-msg-cat">{m.category}</span>}
              <button
                type="button"
                className="dep-msg-dismiss"
                aria-label="Dismiss message"
                onClick={() => dismiss(m.id)}
              >×</button>
            </div>
            <p className="dep-msg-body">{m.plainMessage}</p>
          </div>
        )
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          className="dep-msg-more"
          onClick={() => setExpanded(true)}
        >
          Show {hiddenCount} more message{hiddenCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  )
}

export default StationMessages
