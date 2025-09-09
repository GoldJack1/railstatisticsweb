import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './components/Home'
import Stations from './components/Stations'
import './styles/App.css'

const App: React.FC = () => {
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stations" element={<Stations />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
