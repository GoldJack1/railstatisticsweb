import React from 'react'
import { BUTBaseButtonBar as ButtonBar } from '../../buttons'
import { BUTBaseButton as Button } from '../../buttons'
import type { StationAdminDisplayMode } from '../../../utils/stationAdminDisplayModeStorage'
import './StationAdminControls.css'

interface StationAdminControlsProps {
  isEditMode: boolean
  isSandbox: boolean
  displayMode: StationAdminDisplayMode
  pendingChangesCount: number
  onModeChange: (mode: 'view' | 'edit') => void
  onDisplayModeChange: (mode: StationAdminDisplayMode) => void
  onSandboxChange: (enabled: boolean) => void
  onOpenPendingChanges: () => void
  onAddStation: () => void
}

const StationAdminControls: React.FC<StationAdminControlsProps> = ({
  isEditMode,
  isSandbox,
  displayMode,
  pendingChangesCount,
  onModeChange,
  onDisplayModeChange,
  onSandboxChange,
  onOpenPendingChanges,
  onAddStation,
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
        <span className="station-admin-controls-label">Display</span>
        <ButtonBar
          buttons={[
            { label: 'Cards', value: 'cards' },
            { label: 'Table', value: 'table' },
          ]}
          selectedIndex={displayMode === 'table' ? 1 : 0}
          onChange={(_, value) => onDisplayModeChange(value as StationAdminDisplayMode)}
        />
      </div>

      <div className="station-admin-controls-group">
        <span className="station-admin-controls-label">Sandbox mode</span>
        <ButtonBar
          buttons={[
            { label: 'Off', value: 'off' },
            { label: 'On', value: 'on' }
          ]}
          selectedIndex={isSandbox ? 1 : 0}
          onChange={(_, value) => onSandboxChange(value === 'on')}
        />
      </div>

      {isEditMode && (
        <div className="station-admin-controls-group station-admin-controls-group--add station-admin-controls-group--add-mobile">
          <span className="station-admin-controls-label">Stations</span>
          <Button
            type="button"
            variant="wide"
            width="fill"
            className="station-admin-controls-add-button"
            onClick={onAddStation}
          >
            + Add new station
          </Button>
        </div>
      )}

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
