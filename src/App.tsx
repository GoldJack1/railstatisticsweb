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
  '/stations/new': 'New Station | Rail Statistics',
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
const HomePage = React.lazy(() => import('./pages/HomePage'))
const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const StationsPage = React.lazy(() => import('./pages/StationsPage'))
const StationDatabaseEditPage = React.lazy(() => import('./pages/StationDatabaseEditPage'))
const StationDetailsPage = React.lazy(() => import('./pages/StationDetailsPage'))
const NewStationPage = React.lazy(() => import('./pages/NewStationPage'))
const MigrationPage = React.lazy(() => import('./pages/MigrationPage'))
const ButtonDemoPage = React.lazy(() => import('./pages/ButtonDemoPage'))
const DesignSystemHomePage = React.lazy(() => import('./pages/designSystem/DesignSystemHomePage'))
const ColoursPage = React.lazy(() => import('./pages/designSystem/ColoursPage'))
const TypographyPage = React.lazy(() => import('./pages/designSystem/TypographyPage'))
const ButtonsPage = React.lazy(() => import('./pages/designSystem/ButtonsPage'))
const LayoutPage = React.lazy(() => import('./pages/designSystem/LayoutPage'))
const ComponentsPage = React.lazy(() => import('./pages/designSystem/ComponentsPage'))
const IconsPage = React.lazy(() => import('./pages/designSystem/IconsPage'))
const PrivacyPolicyPage = React.lazy(() => import('./pages/legal/PrivacyPolicyPage'))
const EulaPage = React.lazy(() => import('./pages/legal/EulaPage'))

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
                  <Route path="/" element={<MigrationPage />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/log-in" element={<LoginPage />} />
                  <Route path="/stations" element={<ProtectedRoute><StationsPage /></ProtectedRoute>} />
                  <Route path="/stations/new" element={<ProtectedRoute><NewStationPage /></ProtectedRoute>} />
                  <Route path="/stations/:stationId" element={<ProtectedRoute><StationDetailsPage mode="view" /></ProtectedRoute>} />
                  <Route path="/stations/:stationId/edit" element={<ProtectedRoute><StationDetailsPage mode="edit" /></ProtectedRoute>} />
                  <Route path="/station-database-edit" element={<ProtectedRoute><StationDatabaseEditPage /></ProtectedRoute>} />
                  <Route path="/migration" element={<MigrationPage />} />
                  <Route path="/buttons" element={<ButtonDemoPage />} />
                  <Route path="/design-system" element={<ProtectedRoute><DesignSystemHomePage /></ProtectedRoute>} />
                  <Route path="/design-system/colours" element={<ProtectedRoute><ColoursPage /></ProtectedRoute>} />
                  <Route path="/design-system/typography" element={<ProtectedRoute><TypographyPage /></ProtectedRoute>} />
                  <Route path="/design-system/buttons" element={<ProtectedRoute><ButtonsPage /></ProtectedRoute>} />
                  <Route path="/design-system/layout" element={<ProtectedRoute><LayoutPage /></ProtectedRoute>} />
                  <Route path="/design-system/components" element={<ProtectedRoute><ComponentsPage /></ProtectedRoute>} />
                  <Route path="/design-system/icons" element={<ProtectedRoute><IconsPage /></ProtectedRoute>} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/eula" element={<EulaPage />} />
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
