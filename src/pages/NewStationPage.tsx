import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStationCollection } from '../contexts/StationCollectionContext'
import { useNextStationId } from '../hooks/useNextStationId'
import { NewStationForm } from '../components/models'
import type { StationDetailsTab } from '../components/models'
import { BUTSharedNativeButton } from '../components/buttons'
import { BUTWideButton } from '../components/buttons'
import { NETWORK_LABELS } from '../constants/stationCollections'
import type { NetworkCollectionId } from '../constants/stationCollections'
import '../components/models/StationModal/StationModal.css'
import '../components/models/StationEditModal/StationEditModal.css'
import './StationDetailsPage/StationDetailsPage.css'

const NewStationPage: React.FC = () => {
  const navigate = useNavigate()
  const { networkId } = useStationCollection()
  const [targetCollectionId, setTargetCollectionId] = useState<NetworkCollectionId>(networkId)
  const { nextStationId, loading } = useNextStationId(targetCollectionId)
  const [activeTab, setActiveTab] = useState<StationDetailsTab>('details')
  const [isMobile, setIsMobile] = useState(false)
  const [formIsDirty, setFormIsDirty] = useState(false)

  useEffect(() => {
    setTargetCollectionId(networkId)
  }, [networkId])

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.title = 'New Station | Rail Statistics'
  }, [])

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container container--station-details">
      <div className="station-details-page">
        <header className="station-details-header">
          <div>
            <h1 className="station-details-title">Add new station</h1>
            <div className="station-details-subtitle">
              <span>New ID: {nextStationId}</span>
              <span> · {NETWORK_LABELS[targetCollectionId]}</span>
            </div>
          </div>
          <div className="station-details-header-right">
            <div id="station-details-header-actions" />
          </div>
        </header>

        <div className="station-details-layout">
          <aside className="station-details-sidebar">
            <div className="station-details-sidebar-actions">
              <BUTWideButton
                type="button"
                width="hug"
                onClick={() => {
                  if (formIsDirty && !window.confirm('Are you sure you want to go back? All data will not be saved.')) return
                  navigate(-1)
                }}
              >
                Back
              </BUTWideButton>
            </div>
            <div className="station-details-sidebar-secondary-actions">
              <div id="station-details-sidebar-actions" />
            </div>
            <nav className="station-details-tabs" aria-label="Form sections">
              <BUTSharedNativeButton
                type="button"
                className={`station-details-tab ${activeTab === 'details' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </BUTSharedNativeButton>
              <BUTSharedNativeButton
                type="button"
                className={`station-details-tab ${activeTab === 'additional' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('additional')}
              >
                Additional details
              </BUTSharedNativeButton>
              <BUTSharedNativeButton
                type="button"
                className={`station-details-tab ${activeTab === 'service' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('service')}
              >
                Service & Connections
              </BUTSharedNativeButton>
              <BUTSharedNativeButton
                type="button"
                className={`station-details-tab ${activeTab === 'location' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('location')}
              >
                Location
              </BUTSharedNativeButton>
              <BUTSharedNativeButton
                type="button"
                className={`station-details-tab ${activeTab === 'usage' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('usage')}
              >
                Usage
              </BUTSharedNativeButton>
              <BUTSharedNativeButton
                type="button"
                className={`station-details-tab ${activeTab === 'stepFree' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('stepFree')}
              >
                Step-free & Lift access
              </BUTSharedNativeButton>
              <BUTSharedNativeButton
                type="button"
                className={`station-details-tab ${activeTab === 'facilities' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('facilities')}
              >
                Facilities
              </BUTSharedNativeButton>
            </nav>
          </aside>

          <main className="station-details-main">
            <section className="station-details-card modal-content modal-content-edit">
              <NewStationForm
                nextStationId={nextStationId}
                targetCollectionId={targetCollectionId}
                onTargetCollectionChange={setTargetCollectionId}
                onCancel={() => navigate(-1)}
                onCreated={() => navigate('/stations', { replace: true })}
                activeTab={activeTab}
                actionsPortalId={isMobile ? 'station-details-sidebar-actions' : 'station-details-header-actions'}
                onDirtyChange={setFormIsDirty}
              />
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default NewStationPage
