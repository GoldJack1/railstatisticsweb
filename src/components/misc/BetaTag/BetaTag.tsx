import React from 'react'
import './BetaTag.css'

interface BetaTagProps {
  className?: string
}

const BetaTag: React.FC<BetaTagProps> = ({ className = '' }) => {
  return <span className={`rs-beta-tag ${className}`.trim()}>Beta</span>
}

export default BetaTag
