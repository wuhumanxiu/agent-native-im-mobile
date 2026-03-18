import { create } from 'zustand'
import { Appearance } from 'react-native'
import { loadSetting, saveSetting } from '../lib/storage'

export type Theme = 'system' | 'dark' | 'light' | 'midnight' | 'green' | 'rose' | 'ocean' | 'amber' | 'violet' | 'light-rose' | 'light-ocean' | 'light-green'
export type Locale = 'en' | 'zh-CN'

interface SettingsState {
  theme: Theme
  locale: Locale
  devMode: boolean
  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
  setDevMode: (devMode: boolean) => void
  /** Resolve the effective theme based on system preference */
  effectiveTheme: () => 'dark' | 'light'
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: loadSetting<Theme>('aim_theme', 'light'),
  locale: loadSetting<Locale>('aim_locale', 'en'),
  devMode: loadSetting<boolean>('aim_dev_mode', false),
  setTheme: (theme) => {
    saveSetting('aim_theme', theme)
    set({ theme })
  },
  setLocale: (locale) => {
    saveSetting('aim_locale', locale)
    set({ locale })
  },
  setDevMode: (devMode) => {
    saveSetting('aim_dev_mode', devMode)
    set({ devMode })
  },
  effectiveTheme: () => {
    const { theme } = get()
    if (theme === 'system') {
      return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
    }
    const darkThemes = ['dark', 'midnight', 'green', 'rose', 'ocean', 'amber', 'violet']
    return darkThemes.includes(theme) ? 'dark' : 'light'
  },
}))

// Listen for OS color scheme changes
Appearance.addChangeListener(({ colorScheme }) => {
  const currentTheme = useSettingsStore.getState().theme
  if (currentTheme === 'system') {
    // Force re-render by touching the store
    useSettingsStore.setState({ theme: 'system' })
  }
})
