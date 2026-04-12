import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import * as api from './api'

export function isNativePushSupported(): boolean {
  return Device.isDevice
}

function getProjectId(): string | null {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  return (fromExtra || fromEas || null) as string | null
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null
  const projectId = getProjectId()
  if (!projectId) return null
  const permissions = await Notifications.getPermissionsAsync()
  let status = permissions.status
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync()
    status = requested.status
  }
  if (status !== 'granted') return null
  const token = await Notifications.getExpoPushTokenAsync({ projectId })
  return token.data ?? null
}

export async function registerNativePush(token: string): Promise<{ ok: boolean; reason?: 'unsupported' | 'denied' | 'failed' }> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      })
    }
    const expoToken = await getExpoPushToken()
    if (!expoToken) {
      return { ok: false, reason: Device.isDevice ? 'denied' : 'unsupported' }
    }
    const res = await api.registerPush(token, {
      provider: 'expo',
      platform: Platform.OS,
      endpoint: expoToken,
      device_id: `${Platform.OS}:${Device.modelName ?? 'device'}`,
    })
    return res.ok ? { ok: true } : { ok: false, reason: 'failed' }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function unregisterNativePush(token: string): Promise<boolean> {
  try {
    const expoToken = await getExpoPushToken()
    if (!expoToken) return true
    const res = await api.unregisterPush(token, expoToken, 'expo')
    return res.ok === true
  } catch {
    return false
  }
}

export function extractNotificationTarget(data: Record<string, unknown> | undefined | null): string | null {
  if (!data) return null
  if (typeof data.path === 'string' && data.path.trim()) {
    return data.path.trim()
  }
  if (typeof data.conversation_id === 'number' && Number.isFinite(data.conversation_id)) {
    return `/chat/${data.conversation_id}`
  }
  if (typeof data.conversation_id === 'string' && data.conversation_id.trim()) {
    return `/chat/${data.conversation_id.trim()}`
  }
  return '/(tabs)/inbox'
}
