import React, { useEffect } from 'react'
import { PageTopHeader } from '../../components/misc'

const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Page not found | Rail Statistics'
  }, [])

  return (
    <div>
      <PageTopHeader
        title="Page Not Found"
        subtitle="The page you are looking for does not exist or may have moved."
        actionButton={{ to: '/home', label: 'Go to home' }}
      />
    </div>
  )
}

export default NotFoundPage
