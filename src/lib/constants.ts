import { Platform } from 'react-native'

// On web, use relative URLs (nginx proxies /api/ to backend)
// On native, use direct server IP for dev, Cloudflare for production
const defaultApiUrl = Platform.OS === 'web' ? '' : 'http://192.168.44.43:9800'

export const API_BASE_URL = defaultApiUrl
export const WS_BASE_URL = Platform.OS === 'web'
  ? `${typeof location !== 'undefined' ? location.origin.replace(/^http/, 'ws') : 'wss://ani-rn.51pwd.com'}`
  : 'ws://192.168.44.43:9800'
