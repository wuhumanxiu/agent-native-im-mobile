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
const secureKeys = new Set(['aim_token'])
let hydratePromise: Promise<void> = Promise.resolve()

function createStorage(): StorageAdapter {
  if (Platform.OS === 'web') {
    hydratePromise = Promise.resolve()
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
  let SecureStore: any = null
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default
  } catch {}
  try {
    SecureStore = require('expo-secure-store')
  } catch {}

  hydratePromise = (async () => {
    try {
      for (const key of secureKeys) {
        const value = await SecureStore?.getItemAsync?.(key)
        if (value != null) cache.set(key, value)
      }
    } catch {}

    try {
      const keys = await AsyncStorage?.getAllKeys?.()
      if (keys?.length) {
        const nonSecureKeys = keys.filter((key: string) => !secureKeys.has(key))
        if (nonSecureKeys.length > 0) {
          const pairs = await AsyncStorage.multiGet(nonSecureKeys)
          for (const [k, v] of pairs as [string, string | null][]) {
            if (v != null) cache.set(k, v)
          }
        }
      }
    } catch {}
  })()

  return {
    getString: (key) => cache.get(key),
    set: (key, value) => {
      cache.set(key, value)
      if (secureKeys.has(key) && SecureStore?.setItemAsync) {
        SecureStore.setItemAsync(key, value).catch(() => {
          AsyncStorage?.setItem(key, value).catch(() => {})
        })
        return
      }
      AsyncStorage?.setItem(key, value).catch(() => {})
    },
    delete: (key) => {
      cache.delete(key)
      if (secureKeys.has(key) && SecureStore?.deleteItemAsync) {
        SecureStore.deleteItemAsync(key).catch(() => {
          AsyncStorage?.removeItem(key).catch(() => {})
        })
        return
      }
      AsyncStorage?.removeItem(key).catch(() => {})
    },
  }
}

export const storage = createStorage()

export function hydrateStorage(): Promise<void> {
  return hydratePromise
}

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
