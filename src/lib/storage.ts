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
const STARTUP_HYDRATION_KEYS = ['aim_token', 'aim_entity']
const STORAGE_READ_TIMEOUT_MS = 1500

async function withTimeout<T>(operation: Promise<T> | undefined, fallback: T): Promise<T> {
  if (!operation) return fallback

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), STORAGE_READ_TIMEOUT_MS)
      }),
    ])
  } catch {
    return fallback
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function hydrateKeys(AsyncStorage: any, SecureStore: any, keys: string[]): Promise<void> {
  const secureHydrationKeys = SecureStore
    ? keys.filter((key) => secureKeys.has(key))
    : []
  const asyncHydrationKeys = keys.filter((key) => !secureKeys.has(key) || !SecureStore)

  for (const key of secureHydrationKeys) {
    const value = await withTimeout<string | null | undefined>(SecureStore?.getItemAsync?.(key), undefined)
    if (value != null) cache.set(key, value)
  }

  if (asyncHydrationKeys.length > 0) {
    const pairs = await withTimeout<[string, string | null][] | undefined>(
      AsyncStorage?.multiGet?.(asyncHydrationKeys),
      undefined,
    )
    for (const [key, value] of pairs ?? []) {
      if (value != null) cache.set(key, value)
    }
  }
}

async function hydrateAllNonSecureKeys(AsyncStorage: any, SecureStore: any): Promise<void> {
  const keys = await withTimeout<string[] | undefined>(AsyncStorage?.getAllKeys?.(), undefined)
  if (!keys?.length) return
  const asyncHydrationKeys = keys.filter((key) => !secureKeys.has(key) || !SecureStore)
  if (asyncHydrationKeys.length > 0) {
    await hydrateKeys(AsyncStorage, SecureStore, asyncHydrationKeys)
  }
}

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
  if (Platform.OS !== 'android') {
    try {
      SecureStore = require('expo-secure-store')
    } catch {}
  }

  hydratePromise = hydrateKeys(AsyncStorage, SecureStore, STARTUP_HYDRATION_KEYS)
  setTimeout(() => {
    void hydrateAllNonSecureKeys(AsyncStorage, SecureStore)
  }, 750)

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
