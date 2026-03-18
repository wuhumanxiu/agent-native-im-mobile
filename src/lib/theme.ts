/**
 * Theme colors for RN — mirrors web's CSS variable system.
 * Components use useThemeColors() to get current theme colors.
 */
import { useSettingsStore } from '../store/settings'
import { Appearance } from 'react-native'

const lightColors = {
  bg: '#f8f9fa', bgSecondary: '#ffffff', bgTertiary: '#f1f5f9', bgHover: '#f1f5f9',
  text: '#1a1a2e', textSecondary: '#6b7280', textMuted: '#9ca3af',
  accent: '#6366f1', accentDim: '#eef2ff', accentHover: '#4f46e5',
  border: '#e5e7eb', error: '#ef4444', success: '#22c55e', warning: '#f59e0b',
  bubbleSelf: '#eef2ff', bubbleOther: '#f8fafc', bubbleBorderOther: '#e2e8f0',
  statusBar: 'dark' as const,
}

const darkColors = {
  bg: '#0f172a', bgSecondary: '#1e293b', bgTertiary: '#334155', bgHover: '#334155',
  text: '#f1f5f9', textSecondary: '#94a3b8', textMuted: '#64748b',
  accent: '#818cf8', accentDim: '#312e81', accentHover: '#6366f1',
  border: '#334155', error: '#f87171', success: '#4ade80', warning: '#fbbf24',
  bubbleSelf: '#312e81', bubbleOther: '#1e293b', bubbleBorderOther: '#334155',
  statusBar: 'light' as const,
}

const midnightColors = {
  ...darkColors,
  bg: '#030712', bgSecondary: '#111827', bgTertiary: '#1f2937', bgHover: '#1f2937',
  border: '#1f2937',
  bubbleOther: '#111827', bubbleBorderOther: '#1f2937',
}

export type ThemeColors = typeof lightColors

export function resolveThemeColors(theme: string): ThemeColors {
  if (theme === 'system') {
    const scheme = Appearance.getColorScheme()
    return scheme === 'dark' ? darkColors : lightColors
  }
  if (theme === 'dark') return darkColors
  if (theme === 'midnight') return midnightColors
  return lightColors
}

export function useThemeColors(): ThemeColors {
  const theme = useSettingsStore((s) => s.theme)
  return resolveThemeColors(theme)
}
