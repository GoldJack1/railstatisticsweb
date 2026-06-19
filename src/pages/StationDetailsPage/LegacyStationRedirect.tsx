import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStations } from '../../hooks/useStations'
import { useStationCollection } from '../../contexts/StationCollectionContext'
import { buildStationPath, parseLegacyStationPath } from '../../utils/stationAreaSlug'

interface LegacyStationRedirectProps {
  mode: 'view' | 'edit'
}

/** Redirects old `/stations/:id` URLs to `/stations/:network/:stationSlug`. */
const LegacyStationRedirect: React.FC<LegacyStationRedirectProps> = ({ mode }) => {
  const navigate = useNavigate()
  const { legacyStationId = '' } = useParams()
  const { stations, loading, error } = useStations()
  const { collectionId } = useStationCollection()

  useEffect(() => {
    if (loading || error) return
    const stationId = parseLegacyStationPath(legacyStationId)
    const station = stations.find((s) => s.id === stationId) ?? null
    if (!station) return
    const path = buildStationPath(station, collectionId)
    navigate(`/stations/${path}${mode === 'edit' ? '/edit' : ''}`, { replace: true })
  }, [collectionId, error, legacyStationId, loading, mode, navigate, stations])

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

  const stationId = parseLegacyStationPath(legacyStationId)
  const station = stations.find((s) => s.id === stationId) ?? null
  if (!station) {
    return (
      <div className="container">
        <div className="error-state">
          <h3>Station not found</h3>
          <p>We couldn’t find that station in the current data source.</p>
        </div>
      </div>
    )
  }

  return null
}

export default LegacyStationRedirect
