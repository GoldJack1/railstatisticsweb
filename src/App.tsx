import React, { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { StationCollectionProvider } from './contexts/StationCollectionContext'
import { PendingStationChangesProvider } from './contexts/PendingStationChangesContext'
import HomePage from './pages/HomePage/HomePage'
import LoginPage from './pages/LoginPage/LoginPage'
import StationsPageRefactored from './pages/StationsPageRefactored/StationsPageRefactored'
import ReviewPendingChangesPage from './pages/ReviewPendingChangesPage/ReviewPendingChangesPage'
import StationDetailsPage from './pages/StationDetailsPage/StationDetailsPage'
import NewStationPage from './pages/NewStationPage'
import MigrationPage from './pages/MigrationPage/MigrationPage'
import DesignSystemHomePage from './pages/designSystem/DesignSystemHomePage/DesignSystemHomePage'
import ColoursPage from './pages/designSystem/ColoursPage/ColoursPage'
import TypographyPage from './pages/designSystem/TypographyPage/TypographyPage'
import ButtonsPage from './pages/designSystem/ButtonsPage/ButtonsPage'
import LayoutPage from './pages/designSystem/LayoutPage/LayoutPage'
import ComponentsPage from './pages/designSystem/ComponentsPage/ComponentsPage'
import IconsPage from './pages/designSystem/IconsPage/IconsPage'
import HerosPage from './pages/designSystem/HerosPage/HerosPage'
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage/PrivacyPolicyPage'
import EulaPage from './pages/legal/EulaPage/EulaPage'
import MessageCentreAdminPage from './pages/MessageCentreAdminPage/MessageCentreAdminPage'
import MessageCentreDashboardPage from './pages/MessageCentreDashboardPage'
import DarwinDeparturesPage from './pages/DarwinDeparturesPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import UnitLookupPage from './pages/UnitLookupPage'
import Header from './components/misc/Header/Header'
import Footer from './components/misc/Footer/Footer'
import { ProtectedRoute } from './components/firebase'
import './styles/App.css'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Rail Statistics',
  '/home': 'Home | Rail Statistics',
  '/log-in': 'Log in | Rail Statistics',
  '/stations': 'Stations | Rail Statistics',
  '/stations/edit': 'Stations Admin | Rail Statistics',
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
  '/departures': 'Live Departures | Rail Statistics',
  '/services': 'Service Detail | Rail Statistics',
  '/units': 'Unit Lookup | Rail Statistics',
  '/privacy': 'Privacy Policy | Rail Statistics',
  '/eula': 'EULA | Rail Statistics',
}

const App: React.FC = () => {
  const { pathname } = useLocation()
  const isStationsPage = pathname === '/stations' || pathname === '/stations/edit'

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
            <main className={`main-content app-main${isStationsPage ? ' app-main--stations-layout' : ''}`}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/log-in" element={<LoginPage />} />
                <Route path="/stations" element={<ProtectedRoute><StationsPageRefactored /></ProtectedRoute>} />
                <Route path="/stations/edit" element={<ProtectedRoute><StationsPageRefactored initialMode="edit" /></ProtectedRoute>} />
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
                <Route path="/departures" element={<DarwinDeparturesPage />} />
                <Route path="/departures/:code" element={<DarwinDeparturesPage />} />
                <Route path="/services/:rid" element={<ServiceDetailPage />} />
                <Route path="/units" element={<UnitLookupPage />} />
                <Route path="/units/:unitId" element={<UnitLookupPage />} />
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
