import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import './styles/App.css'

// Lazy load components for better performance
const Home = React.lazy(() => import('./components/Home'))
const Stations = React.lazy(() => import('./components/Stations'))
const Migration = React.lazy(() => import('./components/Migration'))
const ButtonDemo = React.lazy(() => import('./components/ButtonDemo'))

const App: React.FC = () => {
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
            <Route path="/" element={<Home />} />
            <Route path="/stations" element={<Stations />} />
            <Route path="/migration" element={<Migration />} />
            <Route path="/buttons" element={<ButtonDemo />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
