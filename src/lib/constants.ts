import { Platform } from 'react-native'
import Constants from 'expo-constants'

const configuredApiUrl = typeof Constants.expoConfig?.extra?.apiBaseUrl === 'string'
  ? Constants.expoConfig.extra.apiBaseUrl
  : ''
const normalizedConfiguredApiUrl = configuredApiUrl.replace(/\/+$/, '')
const fallbackNativeApiUrl = 'https://ani-web.51pwd.com'
const defaultApiUrl = Platform.OS === 'web'
  ? ''
  : (normalizedConfiguredApiUrl || fallbackNativeApiUrl)

export const API_BASE_URL = defaultApiUrl

function toWebSocketBase(url: string): string {
  return url.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
}

export const WS_BASE_URL = Platform.OS === 'web'
  ? `${typeof location !== 'undefined' ? location.origin.replace(/^http/, 'ws') : 'wss://ani-rn.51pwd.com'}`
  : toWebSocketBase(API_BASE_URL || fallbackNativeApiUrl)
