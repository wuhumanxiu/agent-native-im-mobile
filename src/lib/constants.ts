import Constants from 'expo-constants'

export const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'https://ani-web.51pwd.com'
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws')
