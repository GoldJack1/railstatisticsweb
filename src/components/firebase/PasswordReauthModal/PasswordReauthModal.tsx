import React, { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import FirebaseReauthPanel from '../FirebaseReauthPanel'
import './PasswordReauthModal.css'

export interface PasswordReauthModalProps {
  open: boolean
  user: User | null
  onClose: () => void
  /** Called after successful reauthentication. */
  onVerified: () => void
  title?: string
}

/**
 * Step-up before sensitive actions: password and optional TOTP in one dialog (single Verify).
 */
const PasswordReauthModal: React.FC<PasswordReauthModalProps> = ({
  open,
  user,
  onClose,
  onVerified,
  title = 'Confirm it’s you'
}) => {
  const [panelKey, setPanelKey] = useState(0)

  useEffect(() => {
    if (open) setPanelKey(k => k + 1)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !user) return null

  const handleVerified = () => {
    onVerified()
    onClose()
  }

  return (
    <div className="password-reauth-overlay" role="presentation" onClick={onClose}>
      <div
        className="password-reauth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-reauth-title"
        onClick={e => e.stopPropagation()}
      >
        <FirebaseReauthPanel
          key={panelKey}
          user={user}
          title={title}
          titleHeading="h2"
          onVerified={handleVerified}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}

export default PasswordReauthModal
