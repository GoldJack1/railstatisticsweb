import React from 'react'
import type { Station } from '../../../types'
import { LightRailLineStrip } from '../../chips/LightRailLineStrip'
import StationCardActionBar from '../StationCardActionBar/StationCardActionBar'
import '../StationCard/StationCard.css'
import './LightRailStopCard.css'

interface LightRailStopCardProps {
  station: Station
  locationDisplay: string
  onCardClick: () => void
  onInfoClick: () => void
}

const LightRailStopCard: React.FC<LightRailStopCardProps> = ({
  station,
  locationDisplay,
  onCardClick,
  onInfoClick,
}) => {
  return (
    <article className="rs-station-card-stack rs-station-card-stack--light-rail">
      <section className="rs-station-text-card rs-station-text-card--light-rail" onClick={onCardClick}>
        <h3 className="rs-station-name">{station.stationName || 'Unknown Stop'}</h3>
        <p className="rs-station-location">{locationDisplay}</p>
        <LightRailLineStrip linesServed={station.linesServed} />
      </section>
      <StationCardActionBar onInfoClick={onInfoClick} />
    </article>
  )
}

export default LightRailStopCard
