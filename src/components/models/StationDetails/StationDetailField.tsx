import { findPendingFieldChange } from '../../../utils/applyPendingChangesForDisplay'
import type { StationFieldChange } from '../../../utils/stationFieldDiffs'

interface StationDetailFieldProps {
  label: string
  value: string
  pendingFieldChanges?: StationFieldChange[]
}

export function StationDetailField({ label, value, pendingFieldChanges }: StationDetailFieldProps) {
  const pending = findPendingFieldChange(label, pendingFieldChanges ?? [])

  return (
    <div className={`modal-detail-item${pending ? ' modal-detail-item--pending' : ''}`}>
      <span className="modal-detail-label">{label}</span>
      <span className="modal-detail-value">{value}</span>
      {pending && <span className="modal-detail-pending-from">{pending.from}</span>}
    </div>
  )
}

export default StationDetailField
