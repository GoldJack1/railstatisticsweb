import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStations } from '../hooks/useStations'
import type { SandboxStationDoc, Station } from '../types'
import { fetchStationDocumentById } from '../services/firebase'
import { buildStationPath, parseStationPath } from '../utils/stationAreaSlug'
import StationDetailsView, { type StationDetailsTab } from '../components/stationDetails/StationDetailsView'
import StationDetailsEditForm from '../components/stationDetails/StationDetailsEditForm'
import Button from '../components/Button'
import '../components/StationModal.css'
import '../components/StationEditModal.css'
import './StationDetailsPage.css'

interface StationDetailsPageProps {
  mode: 'view' | 'edit'
}

const StationDetailsPage: React.FC<StationDetailsPageProps> = ({ mode }) => {
  const navigate = useNavigate()
  const { stationId: stationIdParam } = useParams()
  const stationId = parseStationPath(stationIdParam ?? '')
  const { stations, loading, error } = useStations()
  const [additionalDoc, setAdditionalDoc] = useState<SandboxStationDoc | null>(null)
  const [additionalLoading, setAdditionalLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<StationDetailsTab>('details')
  const [isMobile, setIsMobile] = useState(false)
  const [editFormHasUnsavedChanges, setEditFormHasUnsavedChanges] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  const station: Station | null = useMemo(() => {
    if (!stationId) return null
    return stations.find((s) => s.id === stationId) ?? null
  }, [stations, stationId])

  useEffect(() => {
    if (!station) return
    document.title =
      mode === 'edit'
        ? `Edit ${station.stationName || 'Station'} | Rail Statistics`
        : `${station.stationName || 'Station'} | Rail Statistics`
  }, [mode, station])

  useEffect(() => {
    if (!stationId) return
    let cancelled = false
    setAdditionalLoading(true)
    setAdditionalDoc(null)
    fetchStationDocumentById(stationId)
      .then((data) => {
        if (cancelled) return
        setAdditionalDoc((data as SandboxStationDoc) ?? null)
      })
      .finally(() => {
        if (!cancelled) setAdditionalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stationId])

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading station…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-state">
          <h3>Failed to Load Station</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!stationId || !station) {
    return (
      <div className="container">
        <div className="error-state">
          <h3>Station not found</h3>
          <p>We couldn’t find that station in the current data source.</p>
          <Button type="button" variant="wide" width="hug" onClick={() => navigate('/stations')}>
            Back to stations
          </Button>
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
              {mode === 'edit' ? 'Edit station' : 'Station details'}: {station.stationName || 'Station'}
            </h1>
            <div className="station-details-subtitle">
              <span>{station.crsCode || 'No CRS'}</span>
              <span className="station-details-dot">·</span>
              <span>ID: {station.id}</span>
            </div>
          </div>
          <div className="station-details-header-right">
            <div id="station-details-header-actions" />
          </div>
        </header>

        <div className="station-details-layout">
          <aside className="station-details-sidebar">
            <div className="station-details-sidebar-actions">
              <Button
                type="button"
                variant="wide"
                width="hug"
                onClick={() => {
                  if (mode === 'edit' && editFormHasUnsavedChanges && !window.confirm('Are you sure you want to go back? All data will not be saved.')) return
                  navigate('/stations')
                }}
              >
                Back
              </Button>
              <div className="station-details-sidebar-actions-spacer" aria-hidden="true" />
              {mode === 'view' ? (
                <Button
                  type="button"
                  variant="circle"
                  ariaLabel="Edit station"
                  onClick={() => navigate(`/stations/${buildStationPath(station)}/edit`)}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  }
                />
              ) : (
                <Button
                  type="button"
                  variant="circle"
                  ariaLabel="View station"
                  onClick={() => navigate(`/stations/${buildStationPath(station)}`)}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                />
              )}
            </div>
            <div className="station-details-sidebar-secondary-actions">
              <div id="station-details-sidebar-actions" />
            </div>

            <nav className="station-details-tabs" aria-label="Station sections">
              <button
                type="button"
                className={`station-details-tab ${activeTab === 'details' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                type="button"
                className={`station-details-tab ${activeTab === 'additional' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('additional')}
              >
                Additional details
              </button>
              <button
                type="button"
                className={`station-details-tab ${activeTab === 'service' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('service')}
              >
                Service & Connections
              </button>
              <button
                type="button"
                className={`station-details-tab ${activeTab === 'location' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('location')}
              >
                Location
              </button>
              <button
                type="button"
                className={`station-details-tab ${activeTab === 'usage' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('usage')}
              >
                Usage
              </button>
              <button
                type="button"
                className={`station-details-tab ${activeTab === 'stepFree' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('stepFree')}
              >
                Step-free & Lift access
              </button>
              <button
                type="button"
                className={`station-details-tab ${activeTab === 'facilities' ? 'station-details-tab--active' : ''}`}
                onClick={() => setActiveTab('facilities')}
              >
                Facilities
              </button>
            </nav>
          </aside>

          <main className="station-details-main">
            <section className={`station-details-card modal-content ${mode === 'edit' ? 'modal-content-edit' : ''}`}>
              {mode === 'edit' ? (
                <StationDetailsEditForm
                  station={station}
                  onCancel={() => navigate('/stations')}
                  onSaved={() => navigate('/stations')}
                  activeTab={activeTab}
                  actionsPortalId={isMobile ? 'station-details-sidebar-actions' : 'station-details-header-actions'}
                  onUnsavedChangesChange={setEditFormHasUnsavedChanges}
                />
              ) : (
                <div className="modal-body">
                  <StationDetailsView
                    station={station}
                    additionalDoc={additionalDoc}
                    additionalLoading={additionalLoading}
                    activeTab={activeTab}
                  />
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default StationDetailsPage

