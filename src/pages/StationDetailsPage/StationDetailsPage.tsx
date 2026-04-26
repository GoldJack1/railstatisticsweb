import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStations } from '../../hooks/useStations'
import type { SandboxStationDoc, Station } from '../../types'
import { fetchStationDocumentById } from '../../services/firebase'
import { buildStationPath, parseStationPath } from '../../utils/stationAreaSlug'
import { StationDetailsView, type StationDetailsTab } from '../../components/models'
import { StationDetailsEditForm } from '../../components/models'
import { BUTWideButton } from '../../components/buttons'
import { BUTCircleButton } from '../../components/buttons'
import '../../components/models/StationModal/StationModal.css'
import '../../components/models/StationEditModal/StationEditModal.css'
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
  const [maxTabContentHeight, setMaxTabContentHeight] = useState(0)
  const visibleBodyRef = useRef<HTMLDivElement | null>(null)
  const tabMeasureRefs = useRef<Partial<Record<StationDetailsTab, HTMLDivElement | null>>>({})
  const TAB_ORDER: StationDetailsTab[] = ['details', 'additional', 'service', 'location', 'usage', 'stepFree', 'facilities']

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

  useLayoutEffect(() => {
    if (mode !== 'view') return

    const measureHeights = () => {
      const heights = TAB_ORDER
        .map((tab) => {
          const pane = tabMeasureRefs.current[tab]
          if (!pane) return 0
          return Math.ceil(pane.getBoundingClientRect().height)
        })
        .filter((height) => height > 0)

      const visibleHeight = Math.ceil(visibleBodyRef.current?.getBoundingClientRect().height ?? 0)
      const nextMax = Math.max(visibleHeight, ...(heights.length > 0 ? heights : [0]))
      if (nextMax <= 0) return
      setMaxTabContentHeight((current) => (current === nextMax ? current : nextMax))
    }

    measureHeights()
    const frameA = window.requestAnimationFrame(measureHeights)
    const frameB = window.requestAnimationFrame(measureHeights)
    window.addEventListener('resize', measureHeights)
    return () => {
      window.cancelAnimationFrame(frameA)
      window.cancelAnimationFrame(frameB)
      window.removeEventListener('resize', measureHeights)
    }
  }, [mode, station?.id, additionalDoc, additionalLoading])

  useEffect(() => {
    setMaxTabContentHeight(0)
  }, [station?.id, mode])

  useEffect(() => {
    const visibleMap = document.querySelector('.station-details-visible-body .location-map-preview-osm') as HTMLElement | null
    const measureMap = document.querySelector('.station-details-measure-layer .location-map-preview-osm') as HTMLElement | null
    const visibleRect = visibleMap?.getBoundingClientRect()
    const measureRect = measureMap?.getBoundingClientRect()
    // #region agent log
    fetch('http://127.0.0.1:7371/ingest/b6fa4275-bcd2-40b2-a149-9100e5c19d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0517c'},body:JSON.stringify({sessionId:'d0517c',runId:'pre-fix',hypothesisId:'H5',location:'StationDetailsPage.tsx:layout-state',message:'Station details layout/map state snapshot',data:{mode,activeTab,isMobile,maxTabContentHeight,visibleMapCount:document.querySelectorAll('.station-details-visible-body .location-map-preview-osm').length,measureMapCount:document.querySelectorAll('.station-details-measure-layer .location-map-preview-osm').length,visibleRect:visibleRect?{width:visibleRect.width,height:visibleRect.height}:null,measureRect:measureRect?{width:measureRect.width,height:measureRect.height}:null},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }, [mode, activeTab, isMobile, maxTabContentHeight, station?.id])

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
          <BUTWideButton type="button" width="hug" onClick={() => navigate('/stations')}>
            Back to stations
          </BUTWideButton>
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
              <BUTWideButton
                type="button"
                width="hug"
                onClick={() => {
                  if (mode === 'edit' && editFormHasUnsavedChanges && !window.confirm('Are you sure you want to go back? All data will not be saved.')) return
                  navigate('/stations')
                }}
              >
                Back
              </BUTWideButton>
              <div className="station-details-sidebar-actions-spacer" aria-hidden="true" />
              {mode === 'view' ? (
                <BUTCircleButton
                  type="button"
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
                <BUTCircleButton
                  type="button"
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
              <BUTWideButton
                type="button"
                width="hug"
                colorVariant="accent"
                className="station-details-tab"
                state={activeTab === 'stepFree' ? 'active' : 'pressed'}
                onClick={() => setActiveTab('stepFree')}
              >
                Step-free & Lift access
              </BUTWideButton>
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
                <div
                  className="modal-body station-details-visible-body"
                  ref={visibleBodyRef}
                  style={maxTabContentHeight > 0 ? { minHeight: `${maxTabContentHeight}px` } : undefined}
                >
                  <StationDetailsView
                    station={station}
                    additionalDoc={additionalDoc}
                    additionalLoading={additionalLoading}
                    activeTab={activeTab}
                  />
                  <div className="station-details-measure-layer" aria-hidden="true">
                    {TAB_ORDER.map((tab) => (
                      <div
                        key={tab}
                        className="station-details-measure-pane"
                        ref={(el) => {
                          tabMeasureRefs.current[tab] = el
                        }}
                      >
                        <StationDetailsView
                          station={station}
                          additionalDoc={additionalDoc}
                          additionalLoading={additionalLoading}
                          activeTab={tab}
                        />
                      </div>
                    ))}
                  </div>
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

