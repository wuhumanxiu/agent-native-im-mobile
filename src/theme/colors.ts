export type ThemeColors = {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentLight: string
  bubbleSelf: string
  bubbleOther: string
  border: string
  borderSubtle: string
  bot: string
  warning: string
  error: string
  success: string
}

export const darkTheme: ThemeColors = {
  bgPrimary: '#0d0e14',
  bgSecondary: '#13141c',
  bgTertiary: '#1a1b26',
  textPrimary: '#e4e4e7',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  accent: '#6366f1',
  accentLight: '#818cf8',
  bubbleSelf: '#4f46e5',
  bubbleOther: '#1e1f2e',
  border: '#27272a',
  borderSubtle: '#1e1f2e',
  bot: '#a78bfa',
  warning: '#f59e0b',
  error: '#ef4444',
  success: '#22c55e',
}

export const lightTheme: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f4f4f5',
  bgTertiary: '#e4e4e7',
  textPrimary: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#a1a1aa',
  accent: '#6366f1',
  accentLight: '#818cf8',
  bubbleSelf: '#6366f1',
  bubbleOther: '#f4f4f5',
  border: '#d4d4d8',
  borderSubtle: '#e4e4e7',
  bot: '#7c3aed',
  warning: '#d97706',
  error: '#dc2626',
  success: '#16a34a',
}

export type ThemeName = 'dark' | 'light'

export const themes: Record<ThemeName, ThemeColors> = {
  dark: darkTheme,
  light: lightTheme,
}
