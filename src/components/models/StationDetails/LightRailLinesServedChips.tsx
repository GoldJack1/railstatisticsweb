import { findPendingFieldChange } from '../../../utils/applyPendingChangesForDisplay'
import type { StationFieldChange } from '../../../utils/stationFieldDiffs'
import { LightRailLineChips } from '../../chips/LightRailLineChips'

const BLANK_DISPLAY = '---'

interface LightRailLinesServedChipsProps {
  linesServed: string
  pendingFieldChanges?: StationFieldChange[]
}

export function LightRailLinesServedChips({
  linesServed,
  pendingFieldChanges,
}: LightRailLinesServedChipsProps) {
  const pending = findPendingFieldChange('Lines served', pendingFieldChanges ?? [])

  return (
    <div className={`modal-detail-item${pending ? ' modal-detail-item--pending' : ''}`}>
      <span className="modal-detail-label">Lines served</span>
      <LightRailLineChips
        linesServed={linesServed}
        className="light-rail-lines-chips--detail"
        emptyLabel={BLANK_DISPLAY}
      />
      {pending && <span className="modal-detail-pending-from">{pending.from}</span>}
    </div>
  )
}

export default LightRailLinesServedChips
