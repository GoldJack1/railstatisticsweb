import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BUTSquareButton, BUTWideButton } from '../../components/buttons'
import BUTDDMList from '../../components/buttons/ddm/BUTDDMList'
import { PageTopHeader } from '../../components/misc'
import TXTINPBUTIconWideButtonSearch from '../../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'
import { fetchDarwin } from '../../utils/darwinReadyFetch'
import './UnitsInServicePage.css'

type UnitCatalogItem = {
  unitId: string
  fleetId: string | null
  endOfDayMileageByDate?: Record<string, number>
  services?: Array<{ start?: string | null }>
}

type UnitCatalogResponse = {
  units: UnitCatalogItem[]
  updatedAt?: string
}

type UnitCatalogCacheEntry = {
  data: UnitCatalogItem[]
  updatedAt?: string
  cachedAtMs: number
}

const unitsCatalogSWRCache = new Map<string, UnitCatalogCacheEntry>()
const CATALOG_CACHE_KEY = 'units-catalog'
const CATALOG_CACHE_MAX_AGE_MS = 5 * 60_000

const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="7" cy="7" r="4" />
    <line x1="11" y1="11" x2="13" y2="13" />
  </svg>
)

const UnitsInServicePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [catalog, setCatalog] = useState<UnitCatalogItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null)
  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const selectedDay = query.get('unitDay') || 'all'
  const [searchInput, setSearchInput] = useState('')

  const updateQuery = (updater: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(location.search)
    updater(next)
    navigate(
      {
        pathname: location.pathname,
        search: next.toString() ? `?${next.toString()}` : '',
      },
      { replace: true }
    )
  }

  const submitSearch = () => {
    const next = searchInput.trim().toUpperCase()
    if (!next) return
    const qp = new URLSearchParams()
    if (selectedDay && selectedDay !== 'all') qp.set('unitDay', selectedDay)
    navigate(`/units/${encodeURIComponent(next)}${qp.toString() ? `?${qp.toString()}` : ''}`)
  }

  const availableDays = useMemo(() => {
    const dates = new Set<string>()
    for (const unit of catalog) {
      for (const d of Object.keys(unit.endOfDayMileageByDate || {})) dates.add(d)
      for (const svc of unit.services || []) {
        const start = (svc?.start || '').slice(0, 10)
        if (start) dates.add(start)
      }
    }
    return [...dates].sort((a, b) => b.localeCompare(a))
  }, [catalog])

  const dayFilteredCatalog = useMemo(() => {
    if (selectedDay === 'all') return catalog
    return catalog.filter((unit) => {
      if (unit.endOfDayMileageByDate && selectedDay in unit.endOfDayMileageByDate) return true
      return (unit.services || []).some((svc) => (svc?.start || '').slice(0, 10) === selectedDay)
    })
  }, [catalog, selectedDay])

  const totalUnitsForSelectedDay = dayFilteredCatalog.length

  const groups = useMemo(() => {
    const map = new Map<string, UnitCatalogItem[]>()
    for (const unit of dayFilteredCatalog) {
      const fleetId = (unit.fleetId || 'Unknown').trim() || 'Unknown'
      const existing = map.get(fleetId)
      if (existing) existing.push(unit)
      else map.set(fleetId, [unit])
    }

    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([fleetId, units]) => ({
        fleetId,
        units: units
          .slice()
          .sort((a, b) => a.unitId.localeCompare(b.unitId, undefined, { numeric: true })),
      }))
  }, [dayFilteredCatalog])

  const selectedUnits = useMemo(() => {
    if (!selectedFleet) return []
    return groups.find((g) => g.fleetId === selectedFleet)?.units || []
  }, [groups, selectedFleet])

  const classItems = useMemo(
    () => groups.map((group) => `${group.fleetId} (${group.units.length})`),
    [groups]
  )

  const selectedFleetIndex = useMemo(
    () => groups.findIndex((group) => group.fleetId === selectedFleet),
    [groups, selectedFleet]
  )

  useEffect(() => {
    const ac = new AbortController()
    const cached = unitsCatalogSWRCache.get(CATALOG_CACHE_KEY)
    if (cached && Date.now() - cached.cachedAtMs <= CATALOG_CACHE_MAX_AGE_MS) {
      setCatalog(cached.data)
      setStatus('ok')
      setError(null)
    } else {
      setStatus('loading')
      setError(null)
    }
    fetchDarwin('/api/darwin/units/catalog', { signal: ac.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((payload: UnitCatalogResponse) => {
        const next = Array.isArray(payload.units) ? payload.units : []
        unitsCatalogSWRCache.set(CATALOG_CACHE_KEY, {
          data: next,
          updatedAt: payload.updatedAt,
          cachedAtMs: Date.now(),
        })
        setCatalog(next)
        setStatus('ok')
      })
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return
        const hasCached = unitsCatalogSWRCache.has(CATALOG_CACHE_KEY)
        if (!hasCached) {
          setStatus('error')
          setError((e as Error)?.message || 'Could not load units catalog.')
        }
      })
    return () => ac.abort()
  }, [])

  useEffect(() => {
    if (availableDays.length === 0) {
      if (selectedDay !== 'all') {
        updateQuery((next) => {
          next.delete('unitDay')
        })
      }
      return
    }
    if (selectedDay !== 'all' && !availableDays.includes(selectedDay)) {
      updateQuery((next) => {
        next.delete('unitDay')
      })
    }
  }, [availableDays, selectedDay])

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedFleet(null)
      return
    }
    if (!selectedFleet || !groups.some((g) => g.fleetId === selectedFleet)) {
      setSelectedFleet(groups[0].fleetId)
    }
  }, [groups, selectedFleet])

  return (
    <div className="units-service-shell">
      <PageTopHeader
        title="Units in service"
        subtitle={status === 'ok' ? 'Browse by class, then pick a unit for details' : 'Loading units catalog...'}
        className="units-service-header"
      />
      <div className="units-service-page">
        <section className="units-service-search" aria-label="Unit search">
          <TXTINPBUTIconWideButtonSearch
            id="units-main-search"
            icon={<SearchIcon />}
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Enter unit ID, e.g. 150001"
            className="units-service-search-input"
            colorVariant="primary"
          />
          <BUTWideButton width="hug" instantAction disabled={!searchInput.trim()} onClick={submitSearch}>
            Go
          </BUTWideButton>
        </section>

        {status === 'ok' && (
          <section className="units-service-day-filter" aria-label="Units day filter">
            <label htmlFor="units-day-filter">Show units for day</label>
            <select
              id="units-day-filter"
              value={selectedDay}
              onChange={(e) => {
                const nextDay = e.target.value
                updateQuery((next) => {
                  if (nextDay === 'all') next.delete('unitDay')
                  else next.set('unitDay', nextDay)
                })
              }}
            >
              <option value="all">All units in collection</option>
              {availableDays.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <span className="units-service-total">
              Total units: <strong>{totalUnitsForSelectedDay}</strong>
            </span>
          </section>
        )}

        {status === 'loading' && (
          <section className="units-service-state">
            <p>Loading units catalog...</p>
          </section>
        )}

        {status === 'error' && (
          <section className="units-service-state units-service-state--error">
            <h2>Could not load units catalog</h2>
            <p>{error}</p>
          </section>
        )}

        {status === 'ok' && (
          <section className="units-service-layout" aria-label="Units in service browser">
            <aside className="units-service-sidebar units-service-sidebar--desktop" aria-label="Classes">
              <h2>Classes</h2>
              <BUTDDMList
                items={classItems}
                filterName="Class"
                selectionMode="single"
                selectedPositions={selectedFleetIndex >= 0 ? [selectedFleetIndex] : []}
                onSelectionChanged={(selectedPositions) => {
                  const idx = selectedPositions[0]
                  if (typeof idx !== 'number') return
                  const selected = groups[idx]
                  if (!selected) return
                  setSelectedFleet(selected.fleetId)
                }}
                colorVariant="primary"
                className="units-service-class-ddm"
              />
            </aside>

            <div className="units-service-content" aria-label="Units by class">
              <div className="units-service-mobile-class-select">
                <BUTDDMList
                  items={classItems}
                  filterName="Class"
                  selectionMode="single"
                  selectedPositions={selectedFleetIndex >= 0 ? [selectedFleetIndex] : []}
                  onSelectionChanged={(selectedPositions) => {
                    const idx = selectedPositions[0]
                    if (typeof idx !== 'number') return
                    const selected = groups[idx]
                    if (!selected) return
                    setSelectedFleet(selected.fleetId)
                  }}
                  colorVariant="primary"
                  className="units-service-class-ddm"
                />
              </div>

              <header className="units-service-content-head units-service-content-head--desktop">
                <h2>{selectedFleet ? `Class ${selectedFleet}` : 'Select a class'}</h2>
                {selectedFleet && (
                  <p>
                    {selectedUnits.length} unit{selectedUnits.length === 1 ? '' : 's'}
                    {selectedDay !== 'all' ? ` on ${selectedDay}` : ' in collection'}
                  </p>
                )}
              </header>

              {selectedFleet && selectedUnits.length > 0 ? (
                <div className="units-service-unit-grid units-service-unit-grid--desktop">
                  {selectedUnits.map((unit) => (
                    <BUTSquareButton
                      key={unit.unitId}
                      colorVariant="primary"
                      className="units-service-unit-btn"
                      onClick={() => {
                        const qp = new URLSearchParams()
                        if (selectedDay && selectedDay !== 'all') qp.set('unitDay', selectedDay)
                        navigate(`/units/${encodeURIComponent(unit.unitId)}${qp.toString() ? `?${qp.toString()}` : ''}`)
                      }}
                      instantAction
                    >
                      {unit.unitId}
                    </BUTSquareButton>
                  ))}
                </div>
              ) : (
                <p className="units-service-muted units-service-muted--desktop">No units available in this class.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default UnitsInServicePage
