import React from 'react'
import { BUTTabButton } from '../../buttons'
import { NETWORK_VIEW_TABS, type NetworkViewFilter } from '../../../constants/stationCollections'
import './NetworkStationTabGroup.css'

interface NetworkStationTabGroupProps {
  value: NetworkViewFilter
  onChange: (value: NetworkViewFilter) => void
  className?: string
}

const NetworkStationTabGroup: React.FC<NetworkStationTabGroupProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <div
      className={`network-station-tab-group ${className}`.trim()}
      role="tablist"
      aria-label="Station network"
    >
      {NETWORK_VIEW_TABS.map((tab) => {
        const isSelected = value === tab.value
        return (
          <BUTTabButton
            key={tab.value}
            type="button"
            width="hug"
            pressed={isSelected}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </BUTTabButton>
        )
      })}
    </div>
  )
}

export default NetworkStationTabGroup
