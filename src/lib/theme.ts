/**
 * Theme colors for RN.
 * Mobile now uses distinct palettes per theme instead of collapsing most themes
 * into a single light/dark pair. This keeps theme switching visually meaningful
 * and improves dark-mode text contrast.
 */
import { Appearance } from 'react-native'
import { useSettingsStore, type Theme } from '../store/settings'

export interface ThemeColors {
  bg: string
  bgSecondary: string
  bgTertiary: string
  bgHover: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentDim: string
  accentHover: string
  border: string
  error: string
  success: string
  warning: string
  bubbleSelf: string
  bubbleOther: string
  bubbleBorderOther: string
  statusBar: 'light' | 'dark'
}

export interface ThemePreview {
  bg: string
  sidebar: string
  bubble: string
  bubbleSelf: string
  text: string
}

interface ThemeDefinition {
  colors: ThemeColors
  preview: ThemePreview
}

function defineTheme(
  colors: Omit<ThemeColors, 'error' | 'success' | 'warning'> & Partial<Pick<ThemeColors, 'error' | 'success' | 'warning'>>,
  preview?: Partial<ThemePreview>,
): ThemeDefinition {
  const mergedColors: ThemeColors = {
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    ...colors,
  }

  return {
    colors: mergedColors,
    preview: {
      bg: mergedColors.bgSecondary,
      sidebar: mergedColors.bgTertiary,
      bubble: mergedColors.bubbleOther,
      bubbleSelf: mergedColors.accent,
      text: mergedColors.text,
      ...preview,
    },
  }
}

const themes: Record<Exclude<Theme, 'system'>, ThemeDefinition> = {
  light: defineTheme({
    bg: '#f4f7fb',
    bgSecondary: '#ffffff',
    bgTertiary: '#eef2f8',
    bgHover: '#e8eef7',
    text: '#142033',
    textSecondary: '#4b5b73',
    textMuted: '#6e7f97',
    accent: '#4f46e5',
    accentDim: '#e5e7ff',
    accentHover: '#4338ca',
    border: '#d9e1ec',
    bubbleSelf: '#e4e7ff',
    bubbleOther: '#f8fafd',
    bubbleBorderOther: '#dce5f0',
    statusBar: 'dark',
  }, {
    bg: '#f8fafc',
    sidebar: '#eef2f8',
    bubble: '#dbe4ef',
    bubbleSelf: '#4f46e5',
    text: '#142033',
  }),
  'light-rose': defineTheme({
    bg: '#fff5f9',
    bgSecondary: '#fffafc',
    bgTertiary: '#ffe8f1',
    bgHover: '#ffdce9',
    text: '#321624',
    textSecondary: '#6e4457',
    textMuted: '#907082',
    accent: '#db2777',
    accentDim: '#ffe3f0',
    accentHover: '#be185d',
    border: '#f0d5e1',
    bubbleSelf: '#ffe0ee',
    bubbleOther: '#fff7fb',
    bubbleBorderOther: '#f3dbe6',
    statusBar: 'dark',
  }, {
    bg: '#fdf2f8',
    sidebar: '#fce7f3',
    bubble: '#fbcfe8',
    bubbleSelf: '#db2777',
    text: '#321624',
  }),
  'light-ocean': defineTheme({
    bg: '#f2f9ff',
    bgSecondary: '#fbfdff',
    bgTertiary: '#e3f1fb',
    bgHover: '#d5e9f8',
    text: '#10273a',
    textSecondary: '#41627d',
    textMuted: '#68829a',
    accent: '#0284c7',
    accentDim: '#dff3ff',
    accentHover: '#0369a1',
    border: '#d1e5f3',
    bubbleSelf: '#dcedff',
    bubbleOther: '#f8fbff',
    bubbleBorderOther: '#d9e9f5',
    statusBar: 'dark',
  }, {
    bg: '#f0f9ff',
    sidebar: '#e0f2fe',
    bubble: '#bae6fd',
    bubbleSelf: '#0284c7',
    text: '#10273a',
  }),
  'light-green': defineTheme({
    bg: '#f3fbf6',
    bgSecondary: '#fcfffd',
    bgTertiary: '#e4f6ea',
    bgHover: '#d6eedf',
    text: '#15291f',
    textSecondary: '#486357',
    textMuted: '#6f8a7d',
    accent: '#15803d',
    accentDim: '#ddf6e6',
    accentHover: '#166534',
    border: '#d5e8db',
    bubbleSelf: '#ddf3e5',
    bubbleOther: '#f8fdf9',
    bubbleBorderOther: '#dcecdf',
    statusBar: 'dark',
  }, {
    bg: '#f0fdf4',
    sidebar: '#dcfce7',
    bubble: '#bbf7d0',
    bubbleSelf: '#15803d',
    text: '#15291f',
  }),
  dark: defineTheme({
    bg: '#0d1524',
    bgSecondary: '#151f33',
    bgTertiary: '#1e2a40',
    bgHover: '#26344d',
    text: '#f5f8ff',
    textSecondary: '#d0daeb',
    textMuted: '#9fb0c8',
    accent: '#7c82ff',
    accentDim: '#2a3470',
    accentHover: '#9397ff',
    border: '#31425d',
    bubbleSelf: '#2f3774',
    bubbleOther: '#172237',
    bubbleBorderOther: '#31425d',
    statusBar: 'light',
  }, {
    bg: '#1a1a2e',
    sidebar: '#16162a',
    bubble: '#293247',
    bubbleSelf: '#7c82ff',
    text: '#eef4ff',
  }),
  midnight: defineTheme({
    bg: '#050b16',
    bgSecondary: '#0d1522',
    bgTertiary: '#172130',
    bgHover: '#1d2940',
    text: '#f3f7ff',
    textSecondary: '#d6deee',
    textMuted: '#9ca9c0',
    accent: '#8a7dff',
    accentDim: '#251d62',
    accentHover: '#9e93ff',
    border: '#223047',
    bubbleSelf: '#241d57',
    bubbleOther: '#0f1726',
    bubbleBorderOther: '#243149',
    statusBar: 'light',
  }, {
    bg: '#0b1020',
    sidebar: '#0a1322',
    bubble: '#1a2436',
    bubbleSelf: '#8a7dff',
    text: '#eef4ff',
  }),
  green: defineTheme({
    bg: '#071912',
    bgSecondary: '#0e241b',
    bgTertiary: '#163329',
    bgHover: '#1d4236',
    text: '#eefdf5',
    textSecondary: '#c5e9d4',
    textMuted: '#92bea4',
    accent: '#34d399',
    accentDim: '#184634',
    accentHover: '#6ee7b7',
    border: '#27513e',
    bubbleSelf: '#17533c',
    bubbleOther: '#10261d',
    bubbleBorderOther: '#28503f',
    statusBar: 'light',
  }, {
    bg: '#0d1f17',
    sidebar: '#0a1a13',
    bubble: '#1a3328',
    bubbleSelf: '#34d399',
    text: '#e7fff2',
  }),
  rose: defineTheme({
    bg: '#1a0c14',
    bgSecondary: '#24111c',
    bgTertiary: '#331827',
    bgHover: '#432032',
    text: '#fff2f7',
    textSecondary: '#efd0dd',
    textMuted: '#c99bad',
    accent: '#fb7185',
    accentDim: '#532238',
    accentHover: '#ff8ea0',
    border: '#5a2b3e',
    bubbleSelf: '#5a2337',
    bubbleOther: '#2b1320',
    bubbleBorderOther: '#593044',
    statusBar: 'light',
  }, {
    bg: '#1f0d18',
    sidebar: '#1a0a14',
    bubble: '#331a28',
    bubbleSelf: '#fb7185',
    text: '#fff0f5',
  }),
  ocean: defineTheme({
    bg: '#081723',
    bgSecondary: '#102231',
    bgTertiary: '#183143',
    bgHover: '#204055',
    text: '#f0fbff',
    textSecondary: '#cce8f1',
    textMuted: '#95b8c8',
    accent: '#38bdf8',
    accentDim: '#173e57',
    accentHover: '#67d2ff',
    border: '#2c4f62',
    bubbleSelf: '#18425c',
    bubbleOther: '#132533',
    bubbleBorderOther: '#2e4f61',
    statusBar: 'light',
  }, {
    bg: '#0d171f',
    sidebar: '#0a1319',
    bubble: '#1a2833',
    bubbleSelf: '#38bdf8',
    text: '#e9faff',
  }),
  amber: defineTheme({
    bg: '#181102',
    bgSecondary: '#211806',
    bgTertiary: '#30230b',
    bgHover: '#413113',
    text: '#fff7e9',
    textSecondary: '#f0dcbb',
    textMuted: '#c6a97c',
    accent: '#fbbf24',
    accentDim: '#4a360e',
    accentHover: '#ffd45c',
    border: '#5a4417',
    bubbleSelf: '#5c4210',
    bubbleOther: '#291d08',
    bubbleBorderOther: '#5b4519',
    statusBar: 'light',
  }, {
    bg: '#1a1508',
    sidebar: '#15110a',
    bubble: '#332a1a',
    bubbleSelf: '#fbbf24',
    text: '#fff5db',
  }),
  violet: defineTheme({
    bg: '#15091d',
    bgSecondary: '#1d1027',
    bgTertiary: '#2b1838',
    bgHover: '#3a214a',
    text: '#faf2ff',
    textSecondary: '#e4cdf1',
    textMuted: '#b79ac8',
    accent: '#c084fc',
    accentDim: '#44205f',
    accentHover: '#d3a2ff',
    border: '#55306b',
    bubbleSelf: '#532668',
    bubbleOther: '#24122f',
    bubbleBorderOther: '#54336a',
    statusBar: 'light',
  }, {
    bg: '#180d1f',
    sidebar: '#140a1a',
    bubble: '#281a33',
    bubbleSelf: '#c084fc',
    text: '#f8eeff',
  }),
}

export const themePreviews: Record<Exclude<Theme, 'system'>, ThemePreview> = Object.fromEntries(
  Object.entries(themes).map(([themeName, definition]) => [themeName, definition.preview]),
) as Record<Exclude<Theme, 'system'>, ThemePreview>

export function resolveThemeColors(theme: Theme): ThemeColors {
  if (theme === 'system') {
    const scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
    return themes[scheme].colors
  }
  return themes[theme].colors
}

export function useThemeColors(): ThemeColors {
  const theme = useSettingsStore((s) => s.theme)
  return resolveThemeColors(theme)
}
