import React, { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { StationCollectionProvider } from './contexts/StationCollectionContext'
import { PendingStationChangesProvider } from './contexts/PendingStationChangesContext'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import StationsPageRefactored from './pages/StationsPageRefactored'
import ReviewPendingChangesPage from './pages/ReviewPendingChangesPage'
import StationDetailsPage from './pages/StationDetailsPage'
import NewStationPage from './pages/NewStationPage'
import MigrationPage from './pages/MigrationPage'
import DesignSystemHomePage from './pages/designSystem/DesignSystemHomePage'
import ColoursPage from './pages/designSystem/ColoursPage'
import TypographyPage from './pages/designSystem/TypographyPage'
import ButtonsPage from './pages/designSystem/ButtonsPage'
import LayoutPage from './pages/designSystem/LayoutPage'
import ComponentsPage from './pages/designSystem/ComponentsPage'
import IconsPage from './pages/designSystem/IconsPage'
import HerosPage from './pages/designSystem/HerosPage'
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage'
import EulaPage from './pages/legal/EulaPage'
import MessageCentreAdminPage from './pages/MessageCentreAdminPage'
import MessageCentreDashboardPage from './pages/MessageCentreDashboardPage'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import './styles/App.css'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Rail Statistics',
  '/home': 'Home | Rail Statistics',
  '/log-in': 'Log in | Rail Statistics',
  '/stations': 'Stations | Rail Statistics',
  '/stations/pending-review': 'Review changes | Rail Statistics',
  '/stations/new': 'New Station | Rail Statistics',
  '/migration': 'Migration | Rail Statistics',
  '/buttons': 'Button Components | Rail Statistics',
  '/design-system': 'Design System | Rail Statistics',
  '/design-system/colours': 'Design System Colours | Rail Statistics',
  '/design-system/typography': 'Design System Typography | Rail Statistics',
  '/design-system/buttons': 'Design System Buttons | Rail Statistics',
  '/design-system/layout': 'Design System Layout | Rail Statistics',
  '/design-system/components': 'Design System Components | Rail Statistics',
  '/design-system/icons': 'Design System Icons | Rail Statistics',
  '/design-system/heros': 'Design System Heroes | Rail Statistics',
  '/admin/messages': 'Message Centre Admin | Rail Statistics',
  '/privacy': 'Privacy Policy | Rail Statistics',
  '/eula': 'EULA | Rail Statistics',
}

const App: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? 'Rail Statistics'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <AuthProvider>
      <StationCollectionProvider>
        <PendingStationChangesProvider>
          <div className="app">
            <Header />
            <main className="main-content app-main">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/log-in" element={<LoginPage />} />
                <Route path="/stations" element={<ProtectedRoute><StationsPageRefactored /></ProtectedRoute>} />
                <Route path="/stations/pending-review" element={<ProtectedRoute><ReviewPendingChangesPage /></ProtectedRoute>} />
                <Route path="/stations/new" element={<ProtectedRoute><NewStationPage /></ProtectedRoute>} />
                <Route path="/stations/:stationId" element={<ProtectedRoute><StationDetailsPage mode="view" /></ProtectedRoute>} />
                <Route path="/stations/:stationId/edit" element={<ProtectedRoute><StationDetailsPage mode="edit" /></ProtectedRoute>} />
                <Route path="/migration" element={<MigrationPage />} />
                <Route path="/buttons" element={<ButtonsPage />} />
                <Route path="/design-system" element={<ProtectedRoute><DesignSystemHomePage /></ProtectedRoute>} />
                <Route path="/design-system/colours" element={<ProtectedRoute><ColoursPage /></ProtectedRoute>} />
                <Route path="/design-system/typography" element={<ProtectedRoute><TypographyPage /></ProtectedRoute>} />
                <Route path="/design-system/buttons" element={<ProtectedRoute><ButtonsPage /></ProtectedRoute>} />
                <Route path="/design-system/layout" element={<ProtectedRoute><LayoutPage /></ProtectedRoute>} />
                <Route path="/design-system/components" element={<ProtectedRoute><ComponentsPage /></ProtectedRoute>} />
                <Route path="/design-system/icons" element={<ProtectedRoute><IconsPage /></ProtectedRoute>} />
                <Route path="/design-system/heros" element={<ProtectedRoute><HerosPage /></ProtectedRoute>} />
                <Route path="/admin/messages" element={<ProtectedRoute><MessageCentreDashboardPage /></ProtectedRoute>} />
                <Route path="/admin/messages/new" element={<ProtectedRoute><MessageCentreAdminPage /></ProtectedRoute>} />
                <Route path="/admin/messages/:messageId" element={<ProtectedRoute><MessageCentreAdminPage /></ProtectedRoute>} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/eula" element={<EulaPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </PendingStationChangesProvider>
      </StationCollectionProvider>
    </AuthProvider>
  )
}

export default App
