import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { Platform, NativeModules } from 'react-native'
import { MMKV } from 'react-native-mmkv'
import en from './en.json'
import zhCN from './zh-CN.json'

const storage = new MMKV()

// Detect device language without extra packages
function getDeviceLocale(): string {
  try {
    // iOS
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings
      const locale = settings?.AppleLocale || // iOS 12 and below
        (settings?.AppleLanguages as string[] | undefined)?.[0] || ''
      return locale
    }
    // Android
    if (Platform.OS === 'android') {
      return NativeModules.I18nManager?.localeIdentifier || ''
    }
  } catch {
    // fallback
  }
  return ''
}

function detectLanguage(): string {
  // Check stored preference first
  const stored = storage.getString('aim_locale_raw')
  if (stored) return stored

  // Use device locale
  const locale = getDeviceLocale()
  if (locale.startsWith('zh')) return 'zh-CN'

  // Extract language code (e.g. 'en_US' -> 'en')
  const lang = locale.split(/[_-]/)[0]
  if (lang) return lang

  return 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
