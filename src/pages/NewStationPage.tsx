import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStations } from '../hooks/useStations'
import NewStationForm from '../components/stationDetails/NewStationForm'
import type { StationDetailsTab } from '../components/stationDetails/StationDetailsView'
import Button from '../components/Button'
import '../components/StationModal.css'
import '../components/StationEditModal.css'
import './StationDetailsPage.css'

const NewStationPage: React.FC = () => {
  const navigate = useNavigate()
  const { stations, loading, error } = useStations()
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

  const nextNumericStationId = useMemo(() => {
    const numericStations = stations.filter((station) => /^\d+$/.test(station.id))
    if (numericStations.length === 0) {
      return '0001'
    }

    const maxNumericId = Math.max(...numericStations.map((s) => parseInt(s.id, 10)))
    const next = maxNumericId + 1
    const maxLength = Math.max(4, ...numericStations.map((s) => s.id.length))
    return String(next).padStart(maxLength, '0')
  }, [stations])

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

  if (error) {
    return (
      <div className="container">
        <div className="error-state">
          <h3>Failed to Load Stations</h3>
          <p>{error}</p>
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
              <span>New ID: {nextNumericStationId}</span>
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
                  if (formIsDirty && !window.confirm('Are you sure you want to go back? All data will not be saved.')) return
                  navigate(-1)
                }}
              >
                Back
              </Button>
            </div>
            <div className="station-details-sidebar-secondary-actions">
              <div id="station-details-sidebar-actions" />
            </div>
            <nav className="station-details-tabs" aria-label="Form sections">
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
            <section className="station-details-card modal-content modal-content-edit">
              <NewStationForm
                nextStationId={nextNumericStationId}
                onCancel={() => navigate(-1)}
                onCreated={(id) => navigate(`/stations/${id}/edit`)}
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

