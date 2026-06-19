import React, { useEffect, useState } from 'react'
import { BUTBaseButton as Button, BUTWideButton } from '../../buttons'
import {
  NETWORK_COLLECTION_IDS,
  NETWORK_LABELS,
  type NetworkCollectionId,
} from '../../../constants/stationCollections'
import { NEW_STATION_NETWORK_PROFILES } from '../../../constants/newStationNetworkProfiles'
import '../StationModal/StationModal.css'
import './ChooseNetworkForNewStationModal.css'

interface ChooseNetworkForNewStationModalProps {
  open: boolean
  onConfirm: (collectionId: NetworkCollectionId) => void
  onCancel: () => void
}

const ChooseNetworkForNewStationModal: React.FC<ChooseNetworkForNewStationModalProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  const [selected, setSelected] = useState<NetworkCollectionId | null>(null)

  useEffect(() => {
    if (open) setSelected(null)
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content choose-network-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="choose-network-modal-title"
      >
        <div className="modal-header">
          <h2 id="choose-network-modal-title" className="modal-title">
            Choose network
          </h2>
          <Button
            type="button"
            variant="circle"
            className="modal-close"
            ariaLabel="Close"
            onClick={onCancel}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            }
          />
        </div>
        <div className="modal-body">
          <p className="choose-network-modal__intro">
            Each network uses a different set of fields. Pick where this station should be added.
          </p>
          <ul className="choose-network-modal__list">
            {NETWORK_COLLECTION_IDS.map((id) => {
              const isSelected = selected === id
              const profile = NEW_STATION_NETWORK_PROFILES[id]
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`choose-network-modal__option${isSelected ? ' choose-network-modal__option--selected' : ''}`}
                    onClick={() => setSelected(id)}
                    aria-pressed={isSelected}
                  >
                    <span className="choose-network-modal__option-title">{NETWORK_LABELS[id]}</span>
                    <span className="choose-network-modal__option-desc">{profile.description}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="choose-network-modal__actions">
            <BUTWideButton type="button" width="hug" onClick={onCancel}>
              Cancel
            </BUTWideButton>
            <BUTWideButton
              type="button"
              width="hug"
              colorVariant="accent"
              disabled={selected == null}
              onClick={() => {
                if (selected) onConfirm(selected)
              }}
            >
              Continue
            </BUTWideButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChooseNetworkForNewStationModal
