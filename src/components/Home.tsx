import React from 'react'
import NavigationButton from './NavigationButton'
import './Home.css'

const Home: React.FC = () => {
  return (
    <div className="container">
      <main className="main">
        <div className="hero">
          <h1 className="hero-title">Railway Station Data</h1>
          <p className="hero-subtitle">Explore comprehensive railway station information and passenger statistics</p>
          
          <div className="cta-section">
            <NavigationButton 
              to="/stations"
              variant="wide" 
              width="fixed"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
              }
            >
              View Stations
            </NavigationButton>
          </div>
        </div>

        {/* Features */}
        <section className="features">
          <div className="feature">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
              </svg>
            </div>
            <h3>Station Database</h3>
            <p>Access detailed information for thousands of railway stations across the network.</p>
          </div>

          <div className="feature">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </div>
            <h3>Advanced Search</h3>
            <p>Find stations quickly with powerful search across names, codes, and locations.</p>
          </div>

          <div className="feature">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <h3>Passenger Data</h3>
            <p>View historical passenger statistics and trends for each station.</p>
          </div>
        </section>

        {/* Button Demo Link */}
        <section className="demo-section">
          <h2>Design System</h2>
          <p>Explore our comprehensive button component library</p>
          <NavigationButton 
            to="/buttons"
            variant="wide" 
            width="fixed"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
              </svg>
            }
          >
            View Button Components
          </NavigationButton>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; 2024 Rail Statistics</p>
      </footer>
    </div>
  )
}

export default Home
