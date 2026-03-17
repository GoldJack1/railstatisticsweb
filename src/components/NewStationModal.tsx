import React from 'react'
import './StationModal.css'
import './StationEditModal.css'
import Button from './Button'
import NewStationForm from './stationDetails/NewStationForm'

interface NewStationModalProps {
  isOpen: boolean
  onClose: () => void
  nextStationId: string
}

const NewStationModal: React.FC<NewStationModalProps> = ({ isOpen, onClose, nextStationId }) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-edit" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add new station</h2>
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
        <NewStationForm
          nextStationId={nextStationId}
          onCancel={onClose}
          onCreated={() => onClose()}
        />
      </div>
    </div>
  )
}

export default NewStationModal

