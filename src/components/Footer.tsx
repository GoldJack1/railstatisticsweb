import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'

const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>&copy; {new Date().getFullYear()} Rail Statistics</p>
        <div className="site-footer-links">
          <Link to="/privacy" className="site-footer-link">Privacy Policy</Link>
          <Link to="/eula" className="site-footer-link">EULA</Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer
