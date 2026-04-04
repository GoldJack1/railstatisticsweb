import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { applyStoredThemeToDocument } from './hooks/useTheme'
import './styles/index.css'

applyStoredThemeToDocument()

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    // Ensure users move to the latest bundle quickly instead of staying on stale app code.
    onNeedRefresh() {
      void updateSW(true)
    }
  })
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Avoid stale UI during local dev if a previous SW was installed on this origin.
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister()
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
