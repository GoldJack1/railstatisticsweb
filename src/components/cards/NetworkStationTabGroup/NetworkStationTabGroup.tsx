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
          <div key={tab.value} className="network-station-tab-group__item">
            {isSelected ? (
              <div className="network-station-tab-group__indicator" aria-hidden="true" />
            ) : (
              <div className="network-station-tab-group__indicator network-station-tab-group__indicator--placeholder" aria-hidden="true" />
            )}
            <BUTTabButton
              type="button"
              pressed={isSelected}
              onClick={() => onChange(tab.value)}
            >
              {tab.label}
            </BUTTabButton>
          </div>
        )
      })}
    </div>
  )
}

export default NetworkStationTabGroup
