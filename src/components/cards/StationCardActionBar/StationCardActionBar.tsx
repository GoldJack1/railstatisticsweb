import React, { useMemo, useState } from 'react'
import { BUTBaseButton as Button } from '../../buttons'
import VisitButton from '../../buttons/other/BUTVisitStatusButton'
import './StationCardActionBar.css'

interface StationCardActionBarProps {
  onInfoClick: () => void
}

type VisitStatus = 'visited' | 'not-visited'
const StationCardActionBar: React.FC<StationCardActionBarProps> = ({ onInfoClick }) => {
  const [visitStatus, setVisitStatus] = useState<VisitStatus>('not-visited')
  const [isFavorite, setIsFavorite] = useState(false)

  const isVisited = useMemo(() => visitStatus === 'visited', [visitStatus])

  const handleVisitToggle = () => {
    setVisitStatus((current) => (current === 'visited' ? 'not-visited' : 'visited'))
  }

  const StarIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M8 1.5l2 4.1 4.5.7-3.2 3.1.8 4.4L8 11.7 3.9 13.8l.8-4.4L1.5 6.3l4.5-.7L8 1.5z" fill={isFavorite ? 'currentColor' : 'none'} />
    </svg>
  )

  const InfoIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <line x1="8" y1="7" x2="8" y2="12" />
      <circle cx="8" cy="4.5" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )

  return (
    <section
      className="rs-station-card-action-bar"
      aria-label="Station card actions"
      onClick={(event) => event.stopPropagation()}
    >
      <VisitButton
        visited={isVisited}
        onToggle={handleVisitToggle}
        disabled
        className="rs-station-card-action-bar__visit"
      />
      <Button
        variant="square"
        shape="squared"
        width="hug"
        colorVariant={isFavorite ? 'fav-action' : 'primary'}
        ariaLabel={isFavorite ? 'Remove favorite' : 'Add favorite'}
        icon={StarIcon}
        disabled
        onClick={(event) => {
          event.stopPropagation()
          setIsFavorite((current) => !current)
        }}
      />
      <Button
        variant="square"
        shape="squared"
        width="hug"
        colorVariant="primary"
        ariaLabel="View station details"
        icon={InfoIcon}
        onClick={(event) => {
          event.stopPropagation()
          onInfoClick()
        }}
      />
    </section>
  )
}

export default StationCardActionBar
