import { useState, useEffect } from 'react'

interface UseThemeReturn {
  theme: string
  toggleTheme: () => void
}

export const useTheme = (): UseThemeReturn => {
  const [theme, setTheme] = useState(() => {
    // Check for saved theme preference or default to light mode
    return localStorage.getItem('theme') || 'light'
  })

  useEffect(() => {
    // Apply theme to document
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return { theme, toggleTheme }
}
