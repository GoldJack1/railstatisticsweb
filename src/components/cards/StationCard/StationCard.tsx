import React from 'react'
import type { Station } from '../../../types'
import StationCardActionBar from '../StationCardActionBar/StationCardActionBar'
import './StationCard.css'

interface StationCardProps {
  station: Station
  locationDisplay: string
  onCardClick: () => void
  onInfoClick: () => void
}

const StationCard: React.FC<StationCardProps> = ({
  station,
  locationDisplay,
  onCardClick,
  onInfoClick
}) => {
  return (
    <article className="rs-station-card-stack">
      <section className="rs-station-text-card" onClick={onCardClick}>
        <p className="rs-station-operator">{station.toc || 'Unknown Operator'}</p>
        <h3 className="rs-station-name">{station.stationName || 'Unknown Station'}</h3>
        <p className="rs-station-location">{locationDisplay}</p>
      </section>
      <StationCardActionBar onInfoClick={onInfoClick} />
    </article>
  )
}

export default StationCard
