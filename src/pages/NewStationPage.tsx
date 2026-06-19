import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNextStationId } from '../hooks/useNextStationId'
import { useStationCollectionFieldSchema } from '../hooks/useStationCollectionFieldSchema'
import { NewStationForm } from '../components/models'
import ChooseNetworkForNewStationModal from '../components/models/ChooseNetworkForNewStationModal/ChooseNetworkForNewStationModal'
import { stationDetailsShowsAdditionalTab, type StationDetailsTab } from '../utils/stationCollectionFieldSchema'
import { BUTWideButton } from '../components/buttons'
import { NETWORK_LABELS } from '../constants/stationCollections'
import type { NetworkCollectionId } from '../constants/stationCollections'
import '../components/models/StationModal/StationModal.css'
import '../components/models/StationEditModal/StationEditModal.css'
import './StationDetailsPage/StationDetailsPage.css'

interface NewStationPageContentProps {
  targetCollectionId: NetworkCollectionId
  onChangeNetwork: () => void
}

const NewStationPageContent: React.FC<NewStationPageContentProps> = ({
  targetCollectionId,
  onChangeNetwork,
}) => {
  const navigate = useNavigate()
  const { fieldSchema, loading: schemaLoading } = useStationCollectionFieldSchema(targetCollectionId)
  const { nextStationId, loading: idLoading } = useNextStationId(targetCollectionId)
  const loading = schemaLoading || idLoading
  const showAdditionalTab = stationDetailsShowsAdditionalTab(fieldSchema)
  const [activeTab, setActiveTab] = useState<StationDetailsTab>('details')
  const [isMobile, setIsMobile] = useState(false)
  const [formIsDirty, setFormIsDirty] = useState(false)

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

  useEffect(() => {
    if (activeTab === 'additional' && !showAdditionalTab) setActiveTab('details')
    if (activeTab === 'service' && !fieldSchema.showServiceTab) setActiveTab('details')
    if (activeTab === 'usage' && !fieldSchema.showUsageTab) setActiveTab('details')
    if (activeTab === 'stepFree' && !fieldSchema.showStepFreeTab) setActiveTab('details')
    if (activeTab === 'facilities' && !fieldSchema.showFacilitiesTab) setActiveTab('details')
  }, [
    activeTab,
    showAdditionalTab,
    fieldSchema.showServiceTab,
    fieldSchema.showUsageTab,
    fieldSchema.showStepFreeTab,
    fieldSchema.showFacilitiesTab,
  ])

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
              <BUTWideButton
                type="button"
                width="hug"
                onClick={() => {
                  if (formIsDirty && !window.confirm('Change network? Unsaved data will be lost.')) return
                  onChangeNetwork()
                }}
              >
                Change network
              </BUTWideButton>
            </div>
            <div className="station-details-sidebar-secondary-actions">
              <div id="station-details-sidebar-actions" />
            </div>
            <nav className="station-details-tabs" aria-label="Form sections">
              <BUTWideButton
                type="button"
                width="hug"
                colorVariant="accent"
                className="station-details-tab"
                state={activeTab === 'details' ? 'active' : 'pressed'}
                onClick={() => setActiveTab('details')}
              >
                Details
              </BUTWideButton>
              {showAdditionalTab && (
                <BUTWideButton
                  type="button"
                  width="hug"
                  colorVariant="accent"
                  className="station-details-tab"
                  state={activeTab === 'additional' ? 'active' : 'pressed'}
                  onClick={() => setActiveTab('additional')}
                >
                  Additional details
                </BUTWideButton>
              )}
              {fieldSchema.showServiceTab && (
                <BUTWideButton
                  type="button"
                  width="hug"
                  colorVariant="accent"
                  className="station-details-tab"
                  state={activeTab === 'service' ? 'active' : 'pressed'}
                  onClick={() => setActiveTab('service')}
                >
                  Service & Connections
                </BUTWideButton>
              )}
              <BUTWideButton
                type="button"
                width="hug"
                colorVariant="accent"
                className="station-details-tab"
                state={activeTab === 'location' ? 'active' : 'pressed'}
                onClick={() => setActiveTab('location')}
              >
                Location
              </BUTWideButton>
              {fieldSchema.showUsageTab && (
                <BUTWideButton
                  type="button"
                  width="hug"
                  colorVariant="accent"
                  className="station-details-tab"
                  state={activeTab === 'usage' ? 'active' : 'pressed'}
                  onClick={() => setActiveTab('usage')}
                >
                  Usage
                </BUTWideButton>
              )}
              {fieldSchema.showStepFreeTab && (
                <BUTWideButton
                  type="button"
                  width="hug"
                  colorVariant="accent"
                  className="station-details-tab"
                  state={activeTab === 'stepFree' ? 'active' : 'pressed'}
                  onClick={() => setActiveTab('stepFree')}
                >
                  {fieldSchema.stepFreeTabLabel}
                </BUTWideButton>
              )}
              {fieldSchema.showFacilitiesTab && (
                <BUTWideButton
                  type="button"
                  width="hug"
                  colorVariant="accent"
                  className="station-details-tab"
                  state={activeTab === 'facilities' ? 'active' : 'pressed'}
                  onClick={() => setActiveTab('facilities')}
                >
                  Facilities
                </BUTWideButton>
              )}
            </nav>
          </aside>

          <main className="station-details-main">
            <section className="station-details-card modal-content modal-content-edit">
              <NewStationForm
                nextStationId={nextStationId}
                targetCollectionId={targetCollectionId}
                onCancel={() => navigate(-1)}
                onCreated={() => navigate('/stations', { replace: true })}
                activeTab={activeTab}
                hideNetworkPicker
                actionsPortalId={isMobile ? 'station-details-sidebar-actions' : 'station-details-header-actions'}
                onDirtyChange={setFormIsDirty}
                fieldSchema={fieldSchema}
              />
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

const NewStationPage: React.FC = () => {
  const navigate = useNavigate()
  const [targetCollectionId, setTargetCollectionId] = useState<NetworkCollectionId | null>(null)

  if (!targetCollectionId) {
    return (
      <ChooseNetworkForNewStationModal
        open
        onConfirm={setTargetCollectionId}
        onCancel={() => navigate(-1)}
      />
    )
  }

  return (
    <NewStationPageContent
      targetCollectionId={targetCollectionId}
      onChangeNetwork={() => setTargetCollectionId(null)}
    />
  )
}

export default NewStationPage
