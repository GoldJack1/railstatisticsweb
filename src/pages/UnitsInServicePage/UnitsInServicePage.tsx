import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BUTSquareButton, BUTWideButton } from '../../components/buttons'
import BUTDDMList from '../../components/buttons/ddm/BUTDDMList'
import { PageTopHeader } from '../../components/misc'
import TXTINPBUTIconWideButtonSearch from '../../components/textInputButtons/special/TXTINPBUTIconWideButtonSearch'
import './UnitsInServicePage.css'

type UnitCatalogItem = {
  unitId: string
  fleetId: string | null
}

type UnitCatalogResponse = {
  units: UnitCatalogItem[]
}

const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="7" cy="7" r="4" />
    <line x1="11" y1="11" x2="13" y2="13" />
  </svg>
)

const UnitsInServicePage: React.FC = () => {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<UnitCatalogItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')

  const submitSearch = () => {
    const next = searchInput.trim().toUpperCase()
    if (!next) return
    navigate(`/units/${encodeURIComponent(next)}`)
  }

  const groups = useMemo(() => {
    const map = new Map<string, UnitCatalogItem[]>()
    for (const unit of catalog) {
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
  }, [catalog])

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
    setStatus('loading')
    setError(null)
    fetch('/api/darwin/units/catalog', { signal: ac.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((payload: UnitCatalogResponse) => {
        setCatalog(Array.isArray(payload.units) ? payload.units : [])
        setStatus('ok')
      })
      .catch((e) => {
        if ((e as Error)?.name === 'AbortError') return
        setStatus('error')
        setError((e as Error)?.message || 'Could not load units catalog.')
      })
    return () => ac.abort()
  }, [])

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
                {selectedFleet && <p>{selectedUnits.length} unit{selectedUnits.length === 1 ? '' : 's'}</p>}
              </header>

              {selectedFleet && selectedUnits.length > 0 ? (
                <div className="units-service-unit-grid units-service-unit-grid--desktop">
                  {selectedUnits.map((unit) => (
                    <BUTSquareButton
                      key={unit.unitId}
                      colorVariant="primary"
                      className="units-service-unit-btn"
                      onClick={() => navigate(`/units/${encodeURIComponent(unit.unitId)}`)}
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
