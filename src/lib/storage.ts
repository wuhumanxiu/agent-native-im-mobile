/**
 * Shared storage abstraction.
 * Uses AsyncStorage on native, localStorage on web.
 * Synchronous API (AsyncStorage reads are cached at init).
 */
import { Platform } from 'react-native'

interface StorageAdapter {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  delete(key: string): void
}

// In-memory cache for synchronous access (populated from AsyncStorage on native)
const cache = new Map<string, string>()

function createStorage(): StorageAdapter {
  if (Platform.OS === 'web') {
    return {
      getString: (key) => {
        try { return localStorage.getItem(key) ?? undefined } catch { return undefined }
      },
      set: (key, value) => {
        try { localStorage.setItem(key, value) } catch {}
      },
      delete: (key) => {
        try { localStorage.removeItem(key) } catch {}
      },
    }
  }

  // Native: use AsyncStorage with sync cache
  let AsyncStorage: any = null
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default
    // Hydrate cache from AsyncStorage (fire and forget)
    AsyncStorage.getAllKeys().then((keys: string[]) => {
      if (keys.length > 0) {
        AsyncStorage.multiGet(keys).then((pairs: [string, string | null][]) => {
          for (const [k, v] of pairs) {
            if (v != null) cache.set(k, v)
          }
        })
      }
    }).catch(() => {})
  } catch {}

  return {
    getString: (key) => cache.get(key),
    set: (key, value) => {
      cache.set(key, value)
      AsyncStorage?.setItem(key, value).catch(() => {})
    },
    delete: (key) => {
      cache.delete(key)
      AsyncStorage?.removeItem(key).catch(() => {})
    },
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
