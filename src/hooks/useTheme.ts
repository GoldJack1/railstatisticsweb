import { useState, useEffect } from 'react'

interface UseThemeReturn {
  theme: string
  toggleTheme: () => void
}

export const useTheme = (): UseThemeReturn => {
  const [theme, setTheme] = useState(() => {
    const t = localStorage.getItem('theme') || 'light'
    // Apply before first paint so html gets correct --bg-primary (avoids flash / wrong gutter color)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t)
    }
    return t
  })

  useEffect(() => {
    // Apply on <html> so :root CSS variables match the canvas behind the app
    // (theme on body only left html using light --bg-primary → pale strip when zoomed / overflow)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return { theme, toggleTheme }
}
