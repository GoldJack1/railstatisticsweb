import React from 'react'
import type { Station } from '../types'
import './StationModal.css'

interface StationModalProps {
  station: Station | null
  isOpen: boolean
  onClose: () => void
}

const StationModal: React.FC<StationModalProps> = ({ station, isOpen, onClose }) => {
  if (!isOpen || !station) return null

  const formatYearlyPassengers = (passengers: Record<string, number> | number | string | null): string => {
    if (!passengers) return 'N/A'
    
    if (typeof passengers === 'number') {
      return passengers.toLocaleString()
    }
    
    if (typeof passengers === 'object') {
      const years = Object.keys(passengers)
      if (years.length > 0 && /^\d{4}$/.test(years[0])) {
        const sortedYears = years.sort((a, b) => parseInt(b) - parseInt(a))
        const yearEntries = sortedYears.map(year => {
          const count = passengers[year]
          if (typeof count === 'number') {
            return `${year}: ${count.toLocaleString()}`
          }
          return `${year}: N/A`
        })
        return yearEntries.join('\n')
      }
      
      const possibleKeys = ['value', 'count', 'total', 'passengers', 'number']
      for (const key of possibleKeys) {
        if (passengers[key] && typeof passengers[key] === 'number') {
          return passengers[key].toLocaleString()
        }
      }
      
      return `Object: ${JSON.stringify(passengers).substring(0, 50)}...`
    }
    
    if (typeof passengers === 'string') {
      const num = parseFloat(passengers)
      if (!isNaN(num)) {
        return num.toLocaleString()
      }
      return passengers
    }
    
    return 'N/A'
  }

  const hasCoordinates = station.latitude !== 0 && station.longitude !== 0
  const googleMapsUrl = hasCoordinates 
    ? `https://www.google.com/maps?q=${station.latitude},${station.longitude}`
    : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{station.stationName || 'Unknown Station'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h3 className="modal-section-title">Basic Information</h3>
            <div className="modal-details-grid">
              <div className="modal-detail-item">
                <span className="modal-detail-label">Station ID</span>
                <span className="modal-detail-value">{station.id || 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">CRS Code</span>
                <span className="modal-detail-value">{station.crsCode || 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">Tiploc</span>
                <span className="modal-detail-value">{station.tiploc || 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">TOC</span>
                <span className="modal-detail-value">{station.toc || 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">Country</span>
                <span className="modal-detail-value">{station.country || 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">County</span>
                <span className="modal-detail-value">{station.county || 'N/A'}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-detail-label">Station Area</span>
                <span className="modal-detail-value">{station.stnarea || 'N/A'}</span>
              </div>
            </div>
          </div>

          {hasCoordinates && (
            <div className="modal-section">
              <h3 className="modal-section-title">Location</h3>
              <div className="modal-details-grid">
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Latitude</span>
                  <span className="modal-detail-value">{station.latitude.toFixed(6)}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">Longitude</span>
                  <span className="modal-detail-value">{station.longitude.toFixed(6)}</span>
                </div>
              </div>
              {googleMapsUrl && (
                <a 
                  href={googleMapsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="modal-map-link"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  View on Google Maps
                </a>
              )}
            </div>
          )}

          {station.yearlyPassengers && (
            <div className="modal-section">
              <h3 className="modal-section-title">Passenger Statistics</h3>
              <div className="modal-passengers">
                <span className="modal-detail-label">Yearly Passengers</span>
                <div className="modal-passengers-content" style={{whiteSpace: 'pre-line'}}>
                  {formatYearlyPassengers(station.yearlyPassengers)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StationModal

