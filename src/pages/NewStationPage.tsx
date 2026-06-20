import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useNextStationId } from '../hooks/useNextStationId'
import { useStationCollectionFieldSchema } from '../hooks/useStationCollectionFieldSchema'
import { usePendingStationChanges } from '../contexts/PendingStationChangesContext'
import { NewStationForm } from '../components/models'
import ChooseNetworkForNewStationModal from '../components/models/ChooseNetworkForNewStationModal/ChooseNetworkForNewStationModal'
import { stationDetailsShowsAdditionalTab, type StationDetailsTab } from '../utils/stationCollectionFieldSchema'
import { BUTWideButton } from '../components/buttons'
import { NETWORK_LABELS } from '../constants/stationCollections'
import type { NetworkCollectionId } from '../constants/stationCollections'
import type { NewStationNavigationState } from '../types/newStationNavigation'
import {
  buildPendingNewStationDraftPrefill,
  isPendingNewStationEntry,
} from '../utils/pendingNewStationEdit'
import '../components/models/StationModal/StationModal.css'
import '../components/models/StationEditModal/StationEditModal.css'
import './StationDetailsPage/StationDetailsPage.css'

interface NewStationPageContentProps {
  targetCollectionId: NetworkCollectionId
  onChangeNetwork: () => void
  initialLatitude?: number
  initialLongitude?: number
  returnTo?: string
  editPendingStationId?: string
}

const NewStationPageContent: React.FC<NewStationPageContentProps> = ({
  targetCollectionId,
  onChangeNetwork,
  initialLatitude,
  initialLongitude,
  returnTo,
  editPendingStationId,
}) => {
  const navigate = useNavigate()
  const { pendingChanges } = usePendingStationChanges()
  const pendingEntry = editPendingStationId ? pendingChanges[editPendingStationId] : undefined
  const isEditDraft = Boolean(editPendingStationId && isPendingNewStationEntry(pendingEntry))
  const draftPrefill = useMemo(
    () =>
      isEditDraft && editPendingStationId && pendingEntry
        ? buildPendingNewStationDraftPrefill(editPendingStationId, pendingEntry)
        : null,
    [isEditDraft, editPendingStationId, pendingEntry]
  )
  const { fieldSchema, loading: schemaLoading } = useStationCollectionFieldSchema(targetCollectionId)
  const { nextStationId, loading: idLoading } = useNextStationId(targetCollectionId)
  const stationId = editPendingStationId ?? nextStationId
  const loading = schemaLoading || (!isEditDraft && idLoading)
  const showAdditionalTab = stationDetailsShowsAdditionalTab(fieldSchema)
  const [activeTab, setActiveTab] = useState<StationDetailsTab>(() =>
    initialLatitude != null && initialLongitude != null ? 'location' : 'details'
  )
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
    document.title = isEditDraft ? 'Edit draft station | Rail Statistics' : 'New Station | Rail Statistics'
  }, [isEditDraft])

  useEffect(() => {
    if (!editPendingStationId) return
    if (pendingEntry && isPendingNewStationEntry(pendingEntry)) return
    navigate(returnTo ?? '/stations/pending-review', { replace: true })
  }, [editPendingStationId, pendingEntry, navigate, returnTo])

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
            <h1 className="station-details-title">
              {isEditDraft ? 'Edit unpublished station' : 'Add new station'}
            </h1>
            <div className="station-details-subtitle">
              <span>{isEditDraft ? 'Draft ID' : 'New ID'}: {stationId}</span>
              <span> · {NETWORK_LABELS[targetCollectionId]}</span>
              {isEditDraft && <span> · Not yet published</span>}
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
                  if (returnTo) {
                    navigate(returnTo)
                    return
                  }
                  navigate(-1)
                }}
              >
                Back
              </BUTWideButton>
              {!isEditDraft && (
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
              )}
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
                nextStationId={stationId}
                targetCollectionId={targetCollectionId}
                onCancel={() => (returnTo ? navigate(returnTo) : navigate(-1))}
                onCreated={() => navigate(returnTo ?? '/stations/pending-review')}
                activeTab={activeTab}
                hideNetworkPicker
                actionsPortalId={isMobile ? 'station-details-sidebar-actions' : 'station-details-header-actions'}
                onDirtyChange={setFormIsDirty}
                fieldSchema={fieldSchema}
                initialLatitude={initialLatitude}
                initialLongitude={initialLongitude}
                draftPrefill={draftPrefill}
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
  const location = useLocation()
  const navState = (location.state as NewStationNavigationState | null) ?? null
  const editPendingStationId = navState?.editPendingStationId
  const [targetCollectionId, setTargetCollectionId] = useState<NetworkCollectionId | null>(
    () => navState?.targetCollectionId ?? null
  )

  if (!targetCollectionId) {
    return (
      <ChooseNetworkForNewStationModal
        open
        onConfirm={setTargetCollectionId}
        onCancel={() => (navState?.returnTo ? navigate(navState.returnTo) : navigate(-1))}
      />
    )
  }

  return (
    <NewStationPageContent
      targetCollectionId={targetCollectionId}
      onChangeNetwork={() => setTargetCollectionId(null)}
      initialLatitude={navState?.latitude}
      initialLongitude={navState?.longitude}
      returnTo={navState?.returnTo}
      editPendingStationId={editPendingStationId}
    />
  )
}

export default NewStationPage
