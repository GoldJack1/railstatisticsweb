import React from 'react'
import { BUTTabButton } from '../../buttons'
import {
  NETWORK_VIEW_TABS,
  isNetworkCollection,
  type NetworkViewFilter,
} from '../../../constants/stationCollections'
import { NETWORK_MAP_COLORS } from '../../../constants/stationNetworkMapColors'
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
        const dotColor = isNetworkCollection(tab.value) ? NETWORK_MAP_COLORS[tab.value] : null
        return (
          <BUTTabButton
            key={tab.value}
            type="button"
            width="hug"
            pressed={isSelected}
            onClick={() => onChange(tab.value)}
          >
            <span className="network-station-tab-group__label">
              {dotColor && (
                <span
                  className="network-station-tab-group__dot"
                  style={{ backgroundColor: dotColor }}
                  aria-hidden="true"
                />
              )}
              {tab.label}
            </span>
          </BUTTabButton>
        )
      })}
    </div>
  )
}

export default NetworkStationTabGroup
