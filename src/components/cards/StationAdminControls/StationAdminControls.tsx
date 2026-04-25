import React from 'react'
import { BUTBaseButtonBar as ButtonBar } from '../../buttons'
import { BUTBaseButton as Button } from '../../buttons'
import type { StationCollectionId } from '../../../services/firebase'
import './StationAdminControls.css'

interface StationAdminControlsProps {
  isEditMode: boolean
  collectionId: StationCollectionId
  pendingChangesCount: number
  onModeChange: (mode: 'view' | 'edit') => void
  onCollectionChange: (collectionId: StationCollectionId) => void
  onOpenPendingChanges: () => void
}

const StationAdminControls: React.FC<StationAdminControlsProps> = ({
  isEditMode,
  collectionId,
  pendingChangesCount,
  onModeChange,
  onCollectionChange,
  onOpenPendingChanges
}) => {
  return (
    <section className="station-admin-controls-card" aria-label="Station admin controls">
      <div className="station-admin-controls-group">
        <span className="station-admin-controls-label">Mode</span>
        <ButtonBar
          buttons={[
            { label: 'View only', value: 'view' },
            { label: 'Edit', value: 'edit' }
          ]}
          selectedIndex={isEditMode ? 1 : 0}
          onChange={(_, value) => onModeChange(value as 'view' | 'edit')}
        />
      </div>

      <div className="station-admin-controls-group">
        <span className="station-admin-controls-label">Data source</span>
        <ButtonBar
          buttons={[
            { label: 'Production', value: 'stations2603' },
            { label: 'Sandbox', value: 'newsandboxstations1' }
          ]}
          selectedIndex={collectionId === 'newsandboxstations1' ? 1 : 0}
          onChange={(_, value) => onCollectionChange(value as StationCollectionId)}
        />
      </div>

      <div className="station-admin-controls-group station-admin-controls-group--pending">
        <Button
          type="button"
          variant="wide"
          width="fill"
          colorVariant={pendingChangesCount > 0 ? 'accent' : 'primary'}
          onClick={onOpenPendingChanges}
        >
          Pending changes ({pendingChangesCount})
        </Button>
      </div>
    </section>
  )
}

export default StationAdminControls
