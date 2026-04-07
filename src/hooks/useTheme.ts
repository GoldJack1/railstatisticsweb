import { useState, useEffect } from 'react'

interface UseThemeReturn {
  theme: string
  toggleTheme: () => void
}

/** Matches [data-theme] --bg-secondary in index.css (header chrome / Safari UI tint). */
const THEME_COLOR_HEX = {
  light: '#e8e8e8', // hsl(0 0% 91%)
  dark: '#262626', // hsl(0 0% 15%)
} as const

type ThemeMode = 'light' | 'dark'

/**
 * iOS: `black-translucent` lets the page draw under the status bar so the header tint is continuous.
 * `default` keeps a separate opaque bar (better for light theme + dark status text).
 */
function syncWebViewChromeMeta(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (appleStatus) {
    appleStatus.setAttribute('content', mode === 'dark' ? 'black-translucent' : 'default')
  }
  // Media-aware theme-color tags (index.html) + any plain tag: set all so app theme beats prefers-color-scheme
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
    el.setAttribute('content', THEME_COLOR_HEX[mode])
  })
}

/** Run before React mounts so `data-theme` and iOS `meta` match localStorage on first paint. */
export function applyStoredThemeToDocument(): void {
  if (typeof document === 'undefined') return
  const raw = localStorage.getItem('theme') || 'light'
  const t: ThemeMode = raw === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', t)
  syncWebViewChromeMeta(t)
}

export const useTheme = (): UseThemeReturn => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const raw = localStorage.getItem('theme') || 'light'
    return raw === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    // Apply on <html> so :root CSS variables match the canvas behind the app
    // (theme on body only left html using light --bg-primary → pale strip when zoomed / overflow)
    document.documentElement.setAttribute('data-theme', theme)
    syncWebViewChromeMeta(theme)
  }, [theme])

  const toggleTheme = () => {
    const newTheme: ThemeMode = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return { theme, toggleTheme }
}
