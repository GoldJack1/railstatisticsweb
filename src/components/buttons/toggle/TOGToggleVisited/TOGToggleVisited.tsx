import React from 'react'
import TOGToggle, { type TOGToggleProps } from '../TOGToggle/TOGToggle'
import './TOGToggleVisited.css'

export type TOGToggleVisitedProps = Omit<TOGToggleProps, 'trackOffColor' | 'trackOnColor'>

const TOGToggleVisited: React.FC<TOGToggleVisitedProps> = ({ className = '', ...props }) => {
  const visitedClassName = ['rs-tog-toggle-visited', className].filter(Boolean).join(' ')

  return <TOGToggle {...props} className={visitedClassName} />
}

export default TOGToggleVisited
