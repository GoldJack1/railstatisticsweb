import React from 'react'
import StationsPageRefactored from './StationsPageRefactored'

/** Same stations UI as `/stations`, defaulting to database edit mode (matches old `/station-database-edit` entry). */
const StationDatabaseEditPage: React.FC = () => {
  return <StationsPageRefactored initialMode="edit" />
}

export default StationDatabaseEditPage

