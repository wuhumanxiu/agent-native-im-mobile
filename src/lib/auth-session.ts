import { storage } from './storage'

const TOKEN_KEY = 'aim_token'
const ENTITY_KEY = 'aim_entity'

/**
 * Get the stored auth token.
 */
export function getToken(): string | null {
  return storage.getString(TOKEN_KEY) ?? null
}

/**
 * Store the auth token.
 */
export function setToken(token: string): void {
  storage.set(TOKEN_KEY, token)
}

/**
 * Get the stored entity JSON.
 */
export function getEntity<T>(): T | null {
  const raw = storage.getString(ENTITY_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Store the entity as JSON.
 */
export function setEntity(entity: unknown): void {
  storage.set(ENTITY_KEY, JSON.stringify(entity))
}

/**
 * Clear all auth data (logout).
 */
export function clearAuth(): void {
  storage.delete(TOKEN_KEY)
  storage.delete(ENTITY_KEY)
}

// ─── Session Hooks (used by api.ts for token refresh) ────────────

type SessionHooks = {
  getToken: () => string | null
  setToken: (token: string) => void
  onAuthFailure: () => void
}

let hooks: SessionHooks | null = null

export function setSessionHooks(next: SessionHooks) {
  hooks = next
}

export function getSessionHooks(): SessionHooks | null {
  return hooks
}
