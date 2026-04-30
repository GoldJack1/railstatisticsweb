import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageTopHeader } from '../../components/misc'
import { BUTWideButton } from '../../components/buttons'
import { TextCard } from '../../components/cards'
import { CarriageMap } from '../../components/darwin/CarriageMap'
import { useUnitDetail } from '../../hooks/useUnitDetail'
import type { PtacVehicle, ServiceDetail } from '../../types/darwin'
import './UnitLookupPage.css'
import '../ServiceDetailPage/ServiceDetailPage.css'

type UnitGroup = {
  unitKey: string
  unitId: string | null
  fleetId: string | null
  resourceType: string | null
  unitStatus: string | null
  endOfDayMiles: number | null
  reversed: boolean
  vehicles: PtacVehicle[]
}

type UnitDetailTab = 'overview' | 'service' | 'logs' | 'services'

function formatDateOnly(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const UnitLookupPage: React.FC = () => {
  const { unitId: routeUnitId } = useParams()
  const navigate = useNavigate()
  const unitId = (routeUnitId || '').trim().toUpperCase()
  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState<UnitDetailTab>('overview')
  const { status, data, error } = useUnitDetail({ unitId })
  const [latestService, setLatestService] = useState<ServiceDetail | null>(null)
  const [latestServiceError, setLatestServiceError] = useState<string | null>(null)

  const title = unitId ? `Unit ${unitId}` : 'Unit lookup'
  const subtitle = useMemo(() => {
    if (status === 'loading') return 'Loading PTAC unit detail...'
    if (status === 'ok') return 'Live PTAC-backed unit view'
    if (status === 'not-found') return 'Unit not found'
    if (status === 'error') return error || 'Unable to load unit detail'
    return 'Search by unit ID (e.g. 150001, 801207)'
  }, [status, error])

  const latestServiceUnitGroups = useMemo<UnitGroup[]>(() => {
    if (!latestService?.consist?.allocations?.length) return []
    const map = new Map<string, UnitGroup>()
    latestService.consist.allocations.forEach((a) => {
      ;(a.resourceGroups || []).forEach((g, groupIdx) => {
        const unitKey = `unit-${g.unitId || 'unknown'}-${g.fleetId || 'unknown'}-${groupIdx}`
        const existing = map.get(unitKey)
        if (!existing) {
          map.set(unitKey, {
            unitKey,
            unitId: g.unitId || null,
            fleetId: g.fleetId || null,
            resourceType: g.typeOfResourceLabel || g.typeOfResource || null,
            unitStatus: g.status || null,
            endOfDayMiles: g.endOfDayMiles ?? null,
            reversed: !!a.reversed,
            vehicles: [...(g.vehicles || [])],
          })
          return
        }
        const seen = new Set(existing.vehicles.map((v) => `${v.vehicleId || ''}-${v.position ?? ''}`))
        for (const v of g.vehicles || []) {
          const vk = `${v.vehicleId || ''}-${v.position ?? ''}`
          if (!seen.has(vk)) {
            existing.vehicles.push(v)
            seen.add(vk)
          }
        }
      })
    })
    return [...map.values()]
  }, [latestService])

  const latestServiceLogsByVehicle = useMemo(() => {
    const rows: Array<{
      key: string
      unitId: string
      vehicleId: string
      logCount: number
      defects: Array<{ code?: string | null; description?: string | null }>
    }> = []
    latestServiceUnitGroups.forEach((g) => {
      g.vehicles
        .slice()
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        .forEach((v, idx) => {
          const count = (v.defects || []).length
          rows.push({
            key: `${g.unitKey}-${v.vehicleId || idx}`,
            unitId: g.unitId || 'Unknown',
            vehicleId: v.vehicleId || `Vehicle ${idx + 1}`,
            logCount: count,
            defects: v.defects || [],
          })
        })
    })
    return rows
  }, [latestServiceUnitGroups])

  const renderDetailField = (
    label: string,
    value: string | number | null | undefined,
    opts?: { fullWidth?: boolean }
  ) => {
    if (value == null) return null
    const text = String(value).trim()
    if (!text || text === '—') return null
    return (
      <div className={`svc-allocation-field${opts?.fullWidth ? ' svc-allocation-field--block' : ''}`}>
        <span className="svc-allocation-label">{label}</span>
        <span className="svc-allocation-value">{text}</span>
      </div>
    )
  }

  const sharedFrom = (
    vehicles: PtacVehicle[],
    pick: (v: PtacVehicle) => string | null
  ) => {
    if (vehicles.length === 0) return null
    const first = pick(vehicles[0])
    if (!first) return null
    return vehicles.every((v) => pick(v) === first) ? first : null
  }

  const summariseEnteredService = (vehicles: PtacVehicle[], sharedEntered: string | null) => {
    if (sharedEntered) return formatDateOnly(sharedEntered)
    const enteredByDate = new Map<string, string[]>()
    vehicles.forEach((v) => {
      const date = v.dateEnteredService || 'Unknown date'
      const label = v.vehicleId || `Pos ${v.position ?? '—'}`
      const arr = enteredByDate.get(date) || []
      arr.push(label)
      enteredByDate.set(date, arr)
    })
    return [...enteredByDate.entries()]
      .map(([date, ids]) => `${formatDateOnly(date)}: ${ids.join(', ')}`)
      .join(' | ')
  }

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setLatestService(null)
    setLatestServiceError(null)
    const rid = data?.lastSeenRid
    if (!rid) return

    const ac = new AbortController()
    fetch(`/api/darwin/service/${encodeURIComponent(rid)}`, { signal: ac.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((detail: ServiceDetail) => setLatestService(detail))
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return
        setLatestServiceError((e as Error)?.message || String(e))
      })

    return () => ac.abort()
  }, [data?.lastSeenRid])

  useEffect(() => {
    setActiveTab('overview')
  }, [unitId])

  return (
    <div className="container container--unit-details">
      <PageTopHeader
        title={title}
        subtitle={subtitle}
        className={`unit-header unit-header--${status}`}
        actionContent={!isMobile ? (
          <BUTWideButton width="hug" instantAction onClick={() => navigate('/units')}>
            Back
          </BUTWideButton>
        ) : undefined}
      />
      <div className="unit-page">
        <div className="unit-details-layout">
          <aside className="unit-details-sidebar">
            <div className="unit-details-sidebar-actions">
              <BUTWideButton width="hug" instantAction onClick={() => navigate('/units')}>
                Back
              </BUTWideButton>
            </div>
            <nav className="unit-details-tabs" aria-label="Unit sections">
              <BUTWideButton
                width="hug"
                colorVariant="accent"
                className="unit-details-tab"
                state={activeTab === 'overview' ? 'active' : 'pressed'}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </BUTWideButton>
              <BUTWideButton
                width="hug"
                colorVariant="accent"
                className="unit-details-tab"
                state={activeTab === 'service' ? 'active' : 'pressed'}
                onClick={() => setActiveTab('service')}
              >
                Latest Service
              </BUTWideButton>
              <BUTWideButton
                width="hug"
                colorVariant="accent"
                className="unit-details-tab"
                state={activeTab === 'logs' ? 'active' : 'pressed'}
                onClick={() => setActiveTab('logs')}
              >
                Unit Logs
              </BUTWideButton>
              <BUTWideButton
                width="hug"
                colorVariant="accent"
                className="unit-details-tab"
                state={activeTab === 'services' ? 'active' : 'pressed'}
                onClick={() => setActiveTab('services')}
              >
                Services
              </BUTWideButton>
            </nav>
          </aside>

          <main className="unit-details-main">
            {status === 'idle' && (
              <section className="unit-state-card">
                <p>Enter a unit ID to load PTAC unit details.</p>
              </section>
            )}

            {status === 'not-found' && (
              <section className="unit-state-card unit-state-card--error">
                <h2>Unit not found</h2>
                <p>No PTAC unit currently matches <code>{unitId}</code>.</p>
              </section>
            )}

            {status === 'error' && (
              <section className="unit-state-card unit-state-card--error">
                <h2>Unable to load unit detail</h2>
                <p>{error}</p>
              </section>
            )}

            {data && activeTab === 'overview' && (
              <>
                <section className="unit-summary-card">
                  <div className="unit-summary-grid">
                    <div className="unit-summary-item">
                      <span className="unit-summary-label">Unit ID</span>
                      <span className="unit-summary-value">{data.unitId}</span>
                    </div>
                    <div className="unit-summary-item">
                      <span className="unit-summary-label">Fleet</span>
                      <span className="unit-summary-value">{data.fleetId || '-'}</span>
                    </div>
                    <div className="unit-summary-item">
                      <span className="unit-summary-label">Vehicles</span>
                      <span className="unit-summary-value">{data.vehicles.length}</span>
                    </div>
                    <div className="unit-summary-item">
                      <span className="unit-summary-label">Services in diagram</span>
                      <span className="unit-summary-value">{data.services.length}</span>
                    </div>
                  </div>
                </section>

                <section className="unit-list-card">
                  <h2>Vehicle IDs</h2>
                  <div className="unit-vehicle-list">
                    {data.vehicles.map((v, idx) => (
                      <span key={`${v.vehicleId || idx}`} className="unit-chip">{v.vehicleId || `Vehicle ${idx + 1}`}</span>
                    ))}
                  </div>
                </section>
              </>
            )}

            {data && activeTab === 'logs' && (
              <section className="unit-list-card">
                <h2>Logs by vehicle</h2>
                <div className="unit-services">
                  {!latestService && (
                    <p className="unit-muted">Loading latest service logs...</p>
                  )}
                  {latestService && latestServiceLogsByVehicle.map((row) => (
                    <details key={row.key} className="svc-collapsible-card svc-vehicle-card">
                      <summary className="svc-collapsible-summary">
                        <span className="svc-pattern-title">{row.vehicleId}</span>
                        <span className="unit-log-count-chip">{row.logCount}</span>
                      </summary>
                      <p className="unit-log-count-subtitle">Unit {row.unitId}</p>
                      {row.defects.length > 0 ? (
                        <ul className="svc-vehicle-log-list">
                          {row.defects.map((d, idx) => (
                            <li className="svc-vehicle-log-item" key={`${row.key}-full-${idx}`}>
                              <span className="svc-vehicle-log-main">
                                {d.code || 'No code'} — {d.description || 'No description'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="unit-muted">No logs for this vehicle.</p>
                      )}
                    </details>
                  ))}
                </div>
              </section>
            )}

            {data && activeTab === 'service' && (
              <section className="unit-list-card">
                <h2>Latest service snapshot ({data.lastSeenRid || 'no RID'})</h2>
                {latestServiceError && <p className="unit-muted">Could not load latest service detail: {latestServiceError}</p>}
                {latestService ? (
                  <>
                    <div className="unit-summary-grid">
                      <div className="unit-summary-item">
                        <span className="unit-summary-label">Service</span>
                        <span className="unit-summary-value">
                          {`${latestService.trainId} · ${latestService.originName || latestService.origin} -> ${latestService.destinationName || latestService.destination}`}
                        </span>
                      </div>
                      <div className="unit-summary-item">
                        <span className="unit-summary-label">Allocations</span>
                        <span className="unit-summary-value">{latestService.consist?.allocations?.length || 0}</span>
                      </div>
                      <div className="unit-summary-item">
                        <span className="unit-summary-label">Formation coaches</span>
                        <span className="unit-summary-value">{latestService.formation?.coaches?.length || 0}</span>
                      </div>
                      <div className="unit-summary-item">
                        <span className="unit-summary-label">Stops</span>
                        <span className="unit-summary-value">{latestService.stops.length}</span>
                      </div>
                    </div>
                    <div className="unit-service-formation">
                      <h3>Carriage map</h3>
                      <CarriageMap
                        formation={latestService.formation}
                        consist={latestService.consist}
                        stops={latestService.stops}
                        reverse={latestService.reverseFormation}
                        initialTpl={latestService.origin}
                      />
                    </div>

                    <div className="unit-service-vehicles">
                      {latestServiceUnitGroups.length === 0 ? (
                        <p className="unit-muted">No allocation groups available for this service.</p>
                      ) : (
                        <details className="svc-collapsible-card svc-vehicle-card" open>
                          <summary className="svc-collapsible-summary">
                            <span className="svc-pattern-title">Vehicle details & logs</span>
                          </summary>
                          <p className="svc-allocation-subtitle">Grouped by unit, then one section per vehicle.</p>
                          <div className="svc-vehicle-list">
                            {latestServiceUnitGroups.map((g) => {
                              const sortedVehicles = g.vehicles
                                .slice()
                                .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                              const shared = {
                                vehicleType: sharedFrom(sortedVehicles, (v) => v.typeOfVehicle || null),
                                plannedGroup: sharedFrom(sortedVehicles, (v) => v.plannedGroupId || null),
                                maxSpeed: sharedFrom(sortedVehicles, (v) => (v.maximumSpeedMph != null ? `${v.maximumSpeedMph} mph` : null)),
                                brakeType: sharedFrom(sortedVehicles, (v) => v.trainBrakeTypeLabel || v.trainBrakeType || null),
                                status: sharedFrom(sortedVehicles, (v) => v.vehicleStatus || null),
                                category: sharedFrom(sortedVehicles, (v) => v.registeredCategoryLabel || v.registeredCategory || null),
                                liveryDecor: sharedFrom(sortedVehicles, (v) => ([v.livery, v.decor].filter(Boolean).join(' · ') || null)),
                                entered: sharedFrom(sortedVehicles, (v) => v.dateEnteredService || null),
                              }

                              return (
                                <article className="svc-unit-item" key={g.unitKey}>
                                  <header className="svc-vehicle-head">
                                    <h3 className="svc-vehicle-title">Unit {g.unitId || 'Unknown'}</h3>
                                  </header>
                                  <div className="svc-unit-shared">
                                    <h4 className="svc-vehicle-logs-title">Whole unit (shared details)</h4>
                                    <div className="svc-allocation-grid">
                                      {renderDetailField('Fleet', g.fleetId)}
                                      {renderDetailField('Resource type', g.resourceType)}
                                      {renderDetailField('Unit status', g.unitStatus)}
                                      {renderDetailField('End-of-day miles', g.endOfDayMiles)}
                                      {renderDetailField('Vehicle count', sortedVehicles.length)}
                                      {g.reversed ? renderDetailField('Formation direction', 'Reversed') : null}
                                      {renderDetailField('Vehicle type', shared.vehicleType)}
                                      {renderDetailField('Planned group', shared.plannedGroup)}
                                      {renderDetailField('Max speed', shared.maxSpeed)}
                                      {renderDetailField('Brake type', shared.brakeType)}
                                      {renderDetailField('Status', shared.status)}
                                      {renderDetailField('Category', shared.category)}
                                      {renderDetailField('Livery / decor', shared.liveryDecor)}
                                      {renderDetailField('Date entered service', summariseEnteredService(sortedVehicles, shared.entered), { fullWidth: true })}
                                    </div>
                                  </div>

                                  <div className="svc-unit-vehicles">
                                    {sortedVehicles.map((v, vIdx) => {
                                      const defects = v.defects || []
                                      const lengthWeight = (v.lengthMm != null || v.weightTonnes != null)
                                        ? `${v.lengthMm != null ? `${v.lengthMm} mm` : '—'} / ${v.weightTonnes != null ? `${v.weightTonnes} t` : '—'}`
                                        : null
                                      return (
                                        <article className="svc-vehicle-item" key={`${g.unitKey}-v-${v.vehicleId || vIdx}`}>
                                          <header className="svc-vehicle-head">
                                            <h4 className="svc-vehicle-title">{v.vehicleId || `Vehicle ${vIdx + 1}`}</h4>
                                            <div className="svc-allocation-tags">
                                              {v.position != null && <span className="svc-allocation-tag">Pos {v.position}</span>}
                                              {defects.length > 0 && <span className="svc-allocation-tag svc-allocation-tag--warn">{defects.length} log{defects.length === 1 ? '' : 's'}</span>}
                                            </div>
                                          </header>
                                          <div className="svc-allocation-grid">
                                            {renderDetailField('Specific type', v.specificType || null)}
                                            {renderDetailField('Seats', v.numberOfSeats ?? null)}
                                            {renderDetailField('Cabs', v.cabs ?? null)}
                                            {renderDetailField('Length / weight', lengthWeight)}
                                            {renderDetailField('Special characteristics', v.specialCharacteristics || null)}
                                            {renderDetailField('Vehicle name', v.vehicleName || null)}
                                            {renderDetailField('Date entered service', v.dateEnteredService ? formatDateOnly(v.dateEnteredService) : null)}
                                          </div>
                                          <p className="svc-vehicle-no-logs">Logs: {defects.length}</p>
                                        </article>
                                      )
                                    })}
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="unit-muted">Loading latest service details...</p>
                )}
              </section>
            )}

            {data && activeTab === 'services' && (
              <section className="unit-list-card">
                <h2>Services</h2>
                <div className="unit-services">
                  {data.services.map((svc, idx) => (
                    <TextCard
                      key={`${svc.rid}-${idx}`}
                      title={`${svc.headcode || 'Service'} · ${svc.startName || svc.startTpl || '-'} -> ${svc.endName || svc.endTpl || '-'}`}
                      description={`RID ${svc.rid}${svc.position != null ? ` · Pos ${svc.position}` : ''}${svc.reversed ? ' · Reversed' : ''}`}
                      state="default"
                      onClick={() => navigate(`/services/${encodeURIComponent(svc.rid)}`)}
                      ariaLabel={`Open service ${svc.headcode || svc.rid}`}
                    />
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default UnitLookupPage

