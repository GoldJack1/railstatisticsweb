import React, { Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './styles/App.css'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Rail Statistics',
  '/home': 'Home | Rail Statistics',
  '/stations': 'Stations | Rail Statistics',
  '/migration': 'Migration | Rail Statistics',
  '/buttons': 'Button Components | Rail Statistics',
  '/privacy': 'Privacy Policy | Rail Statistics',
  '/eula': 'EULA | Rail Statistics',
}

// Lazy load components for better performance
const Home = React.lazy(() => import('./components/Home'))
const Stations = React.lazy(() => import('./components/Stations'))
const Migration = React.lazy(() => import('./components/Migration'))
const ButtonDemo = React.lazy(() => import('./components/ButtonDemo'))
const PrivacyPolicy = React.lazy(() => import('./components/PrivacyPolicy'))
const Eula = React.lazy(() => import('./components/Eula'))

const App: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? 'Rail Statistics'
  }, [pathname])

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Suspense fallback={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '200px',
            fontSize: '18px',
            color: 'var(--text-secondary)'
          }}>
            Loading...
          </div>
        }>
          <Routes>
            <Route path="/" element={<Migration />} />
            <Route path="/home" element={<Home />} />
            <Route path="/stations" element={<Stations />} />
            <Route path="/migration" element={<Migration />} />
            <Route path="/buttons" element={<ButtonDemo />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/eula" element={<Eula />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export default App
