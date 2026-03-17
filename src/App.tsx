import React, { Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { StationCollectionProvider } from './contexts/StationCollectionContext'
import { PendingStationChangesProvider } from './contexts/PendingStationChangesContext'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import './styles/App.css'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Rail Statistics',
  '/home': 'Home | Rail Statistics',
  '/log-in': 'Log in | Rail Statistics',
  '/stations': 'Stations | Rail Statistics',
  '/station-database-edit': 'Edit Station Database | Rail Statistics',
  '/migration': 'Migration | Rail Statistics',
  '/buttons': 'Button Components | Rail Statistics',
  '/design-system': 'Design System | Rail Statistics',
  '/design-system/colours': 'Design System Colours | Rail Statistics',
  '/design-system/typography': 'Design System Typography | Rail Statistics',
  '/design-system/buttons': 'Design System Buttons | Rail Statistics',
  '/design-system/layout': 'Design System Layout | Rail Statistics',
  '/design-system/components': 'Design System Components | Rail Statistics',
  '/design-system/icons': 'Design System Icons | Rail Statistics',
  '/privacy': 'Privacy Policy | Rail Statistics',
  '/eula': 'EULA | Rail Statistics',
}

// Lazy load components for better performance
const Home = React.lazy(() => import('./components/Home'))
const LogIn = React.lazy(() => import('./components/LogIn'))
const Stations = React.lazy(() => import('./components/Stations'))
const StationDatabaseEdit = React.lazy(() => import('./components/StationDatabaseEdit'))
const Migration = React.lazy(() => import('./components/Migration'))
const ButtonDemo = React.lazy(() => import('./components/ButtonDemo'))
const DesignSystemHome = React.lazy(() => import('./components/DesignSystemHome'))
const DesignSystemColours = React.lazy(() => import('./components/DesignSystemColours'))
const DesignSystemTypography = React.lazy(() => import('./components/DesignSystemTypography'))
const DesignSystemButtons = React.lazy(() => import('./components/DesignSystemButtons'))
const DesignSystemLayout = React.lazy(() => import('./components/DesignSystemLayout'))
const DesignSystemComponents = React.lazy(() => import('./components/DesignSystemComponents'))
const DesignSystemIcons = React.lazy(() => import('./components/DesignSystemIcons'))
const PrivacyPolicy = React.lazy(() => import('./components/PrivacyPolicy'))
const Eula = React.lazy(() => import('./components/Eula'))

const App: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? 'Rail Statistics'
  }, [pathname])

  return (
    <AuthProvider>
      <StationCollectionProvider>
        <PendingStationChangesProvider>
          <div className="app">
            <Header />
            <main className="main-content">
              <Suspense
                fallback={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '200px',
                      fontSize: '18px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Loading...
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Migration />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/log-in" element={<LogIn />} />
                  <Route path="/stations" element={<ProtectedRoute><Stations /></ProtectedRoute>} />
                  <Route path="/station-database-edit" element={<ProtectedRoute><StationDatabaseEdit /></ProtectedRoute>} />
                  <Route path="/migration" element={<Migration />} />
                  <Route path="/buttons" element={<ButtonDemo />} />
                  <Route path="/design-system" element={<ProtectedRoute><DesignSystemHome /></ProtectedRoute>} />
                  <Route path="/design-system/colours" element={<ProtectedRoute><DesignSystemColours /></ProtectedRoute>} />
                  <Route path="/design-system/typography" element={<ProtectedRoute><DesignSystemTypography /></ProtectedRoute>} />
                  <Route path="/design-system/buttons" element={<ProtectedRoute><DesignSystemButtons /></ProtectedRoute>} />
                  <Route path="/design-system/layout" element={<ProtectedRoute><DesignSystemLayout /></ProtectedRoute>} />
                  <Route path="/design-system/components" element={<ProtectedRoute><DesignSystemComponents /></ProtectedRoute>} />
                  <Route path="/design-system/icons" element={<ProtectedRoute><DesignSystemIcons /></ProtectedRoute>} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/eula" element={<Eula />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </PendingStationChangesProvider>
      </StationCollectionProvider>
    </AuthProvider>
  )
}

export default App
