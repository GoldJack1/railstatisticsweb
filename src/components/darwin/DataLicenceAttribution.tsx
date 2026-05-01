import React from 'react'

type DataLicenceAttributionProps = {
  className?: string
}

/**
 * Standard attribution text required by OGL v3 licensed rail datasets.
 */
const DataLicenceAttribution: React.FC<DataLicenceAttributionProps> = ({ className }) => (
  <span className={className}>
    Contains public sector information licensed under the Open Government Licence v3.0.
  </span>
)

export default DataLicenceAttribution
