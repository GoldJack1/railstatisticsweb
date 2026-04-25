import React, { useState, useEffect } from 'react'
import type { Station, SandboxStationDoc } from '../../../types'
import { useStationCollection } from '../../../contexts/StationCollectionContext'
import { fetchStationDocumentById } from '../../../services/firebase'
import { BUTBaseButton as Button } from '../../buttons'
import StationDetailsView from '../StationDetails/StationDetailsView'
import './StationModal.css'

interface StationModalProps {
  station: Station | null
  isOpen: boolean
  onClose: () => void
}

const StationModal: React.FC<StationModalProps> = ({ station, isOpen, onClose }) => {
  const { collectionId } = useStationCollection()
  const [sandboxDoc, setSandboxDoc] = useState<SandboxStationDoc | null>(null)
  const [sandboxLoading, setSandboxLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !station) {
      setSandboxDoc(null)
      return
    }
    let cancelled = false
    setSandboxLoading(true)
    setSandboxDoc(null)
    fetchStationDocumentById(station.id)
      .then((data) => {
        if (!cancelled && data) setSandboxDoc(data as SandboxStationDoc)
      })
      .finally(() => {
        if (!cancelled) setSandboxLoading(false)
      })
    return () => { cancelled = true }
  }, [isOpen, station, collectionId])

  if (!isOpen || !station) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{station.stationName || 'Unknown Station'}</h2>
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

        <div className="modal-body">
          <StationDetailsView station={station} additionalDoc={sandboxDoc} additionalLoading={sandboxLoading} />
        </div>
      </div>
    </div>
  )
}

export default StationModal
