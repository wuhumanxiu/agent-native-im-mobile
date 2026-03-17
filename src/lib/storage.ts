/**
 * Shared storage abstraction.
 * Uses MMKV on native, localStorage on web.
 */
import { Platform } from 'react-native'

interface StorageAdapter {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

function createStorage(): StorageAdapter {
  if (Platform.OS === 'web') {
    return {
      getString: (key) => {
        try { return localStorage.getItem(key) ?? undefined } catch { return undefined }
      },
      set: (key, value) => {
        try { localStorage.setItem(key, value) } catch { /* quota */ }
      },
      delete: (key) => {
        try { localStorage.removeItem(key) } catch {}
      },
    }
  }
  // Native: use MMKV
  try {
    const { MMKV } = require('react-native-mmkv')
    return new MMKV()
  } catch {
    // Fallback if MMKV fails to load
    return {
      getString: () => undefined,
      set: () => {},
      delete: () => {},
    }
  }
}

export const storage = createStorage()

export function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getString(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function saveSetting(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value))
}
