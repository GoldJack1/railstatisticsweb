import React from 'react'
import NavigationButton from '../components/NavigationButton'
import '../components/Home.css'
import HomeHero, { DEFAULT_IMAGE_SOURCES, type HomeHeroSlide } from '../components/home/HomeHero'

const HERO_SLIDES: HomeHeroSlide[] = [
  {
    title: 'Rail Statistics is Officially Live!',
    body: (
      <>
        <p>After a year of development, the ultimate station tracker is out of beta.</p>
        <p>Download now and start logging your journeys.</p>
        <p>
          Explore comprehensive data for every station, visualise your visits on an interactive map, and get real-time
          alerts the second a new station opens.
        </p>
      </>
    ),
    imageAlt: 'Rail Statistics app preview',
    imageSources: DEFAULT_IMAGE_SOURCES
  },
  {
    title: 'See every visit on the map',
    body: (
      <>
        <p>Visualise the stations you have visited and the ones still on your list in one interactive map.</p>
        <p>Pan, zoom, and tap stations to open rich detail without leaving your flow.</p>
        <p>First Class subscribers can use the Station Action Bar to update visits and favourites in a single tap.</p>
      </>
    ),
    imageAlt: 'Rail Statistics map and station list preview',
    imageSources: DEFAULT_IMAGE_SOURCES
  },
  {
    title: 'Usage data and instant updates',
    body: (
      <>
        <p>Browse passenger usage figures for National Rail stations, with history back to 1998 and annual refreshes.</p>
        <p>Get notified when new stations open—our cloud database keeps everyone on the latest network.</p>
        <p>Start free, then upgrade when you are ready for deeper tools.</p>
      </>
    ),
    imageAlt: 'Rail Statistics insights and notifications preview',
    imageSources: DEFAULT_IMAGE_SOURCES
  }
]

const HomePage: React.FC = () => {
  return (
    <div className="container">
      <div className="main">
        <HomeHero
          slides={HERO_SLIDES}
          primaryCtaLabel="Download on iOS"
          secondaryCtaLabel="Download on Android"
        />

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
      </div>
    </div>
  )
}

export default HomePage

