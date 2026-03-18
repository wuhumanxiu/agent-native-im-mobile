import Constants from 'expo-constants'
import { Platform } from 'react-native'

// On web, use relative URLs (nginx proxies /api/ to backend)
// On native, use the absolute backend URL
const defaultApiUrl = Platform.OS === 'web' ? '' : 'https://ani-web.51pwd.com'
export const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl && Platform.OS !== 'web'
  ? Constants.expoConfig.extra.apiBaseUrl
  : defaultApiUrl
export const WS_BASE_URL = Platform.OS === 'web'
  ? `${typeof location !== 'undefined' ? location.origin.replace(/^http/, 'ws') : 'wss://ani-rn.51pwd.com'}`
  : API_BASE_URL.replace(/^http/, 'ws')
