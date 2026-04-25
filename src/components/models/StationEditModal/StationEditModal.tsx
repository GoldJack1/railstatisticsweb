import React from 'react'
import type { Station } from '../../../types'
import '../StationModal/StationModal.css'
import './StationEditModal.css'
import { BUTBaseButton as Button } from '../../buttons'
import StationDetailsEditForm from '../StationDetails/StationDetailsEditForm'

interface StationEditModalProps {
  station: Station | null
  isOpen: boolean
  onClose: () => void
}

const StationEditModal: React.FC<StationEditModalProps> = ({ station, isOpen, onClose }) => {
  if (!isOpen || !station) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit: {station.stationName || 'Station'}</h2>
          <Button
            type="button"
            variant="circle"
            className="modal-close"
            ariaLabel="Close modal"
            onClick={() => onClose()}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            }
          />
        </div>
        <StationDetailsEditForm station={station} onCancel={onClose} onSaved={onClose} />
      </div>
    </div>
  )
}

export default StationEditModal
