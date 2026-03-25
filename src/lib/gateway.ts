import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { loadSetting, saveSetting, storage } from './storage'
import { setBaseUrl } from './api'

const GATEWAY_KEY = 'aim_gateway_url'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function inferDefaultGatewayUrl(): string {
  const isExpoWebHost = Platform.OS === 'web'
    && typeof location !== 'undefined'
    && location.hostname === 'expo.agent-native.im'
  const configuredApiUrl = typeof Constants.expoConfig?.extra?.apiBaseUrl === 'string'
    ? Constants.expoConfig.extra.apiBaseUrl
    : ''
  const normalizedConfiguredApiUrl = configuredApiUrl.replace(/\/+$/, '')
  const fallbackNativeApiUrl = 'https://agent-native.im'
  if (Platform.OS === 'web') {
    if (isExpoWebHost) return fallbackNativeApiUrl
    return typeof location !== 'undefined' ? trimTrailingSlash(location.origin) : fallbackNativeApiUrl
  }
  return normalizedConfiguredApiUrl || fallbackNativeApiUrl
}

export function getDefaultGatewayUrl(): string {
  return inferDefaultGatewayUrl()
}

export function normalizeGatewayUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return getDefaultGatewayUrl()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new Error('Gateway must use http or https')
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(withProtocol)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Gateway must use http or https')
  }
  return trimTrailingSlash(parsed.origin)
}

export function getGatewayUrl(): string {
  return loadSetting<string>(GATEWAY_KEY, getDefaultGatewayUrl())
}

export function persistGatewayUrl(input: string): string {
  const normalized = normalizeGatewayUrl(input)
  if (normalized === getDefaultGatewayUrl()) {
    storage.delete(GATEWAY_KEY)
  } else {
    saveSetting(GATEWAY_KEY, normalized)
  }
  applyGatewayUrl(normalized)
  return normalized
}

export function clearGatewayUrl(): void {
  storage.delete(GATEWAY_KEY)
  applyGatewayUrl(getDefaultGatewayUrl())
}

export function applyGatewayUrl(url = getGatewayUrl()): void {
  setBaseUrl(trimTrailingSlash(url))
}

export function getApiBaseUrl(): string {
  return getGatewayUrl()
}

export function getWsBaseUrl(): string {
  return getGatewayUrl().replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
}
