/**
 * Shared MMKV storage instance and helpers.
 * All stores use this instead of localStorage/sessionStorage.
 */
import { MMKV } from 'react-native-mmkv'

export const storage = new MMKV()

/**
 * Load a JSON-serialized setting from MMKV.
 */
export function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getString(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

/**
 * Save a JSON-serialized setting to MMKV.
 */
export function saveSetting(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value))
}
