import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { type ThemeColors, type ThemeName, themes, darkTheme } from './colors'

interface ThemeContextType {
  colors: ThemeColors
  themeName: ThemeName
  setTheme: (name: ThemeName) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  colors: darkTheme,
  themeName: 'dark',
  setTheme: () => {},
  isDark: true,
})

const THEME_KEY = 'aim_theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('dark')

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setThemeName(stored)
      }
    }).catch(() => {})
  }, [])

  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name)
    AsyncStorage.setItem(THEME_KEY, name).catch(() => {})
  }, [])

  const value: ThemeContextType = {
    colors: themes[themeName],
    themeName,
    setTheme,
    isDark: themeName === 'dark',
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
