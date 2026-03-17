import { create } from 'zustand'
import type { Entity } from '../lib/types'
import { storage } from '../lib/storage'

interface AuthState {
  token: string | null
  entity: Entity | null
  /** Whether we've attempted session restore on app launch */
  sessionChecked: boolean
  setAuth: (token: string, entity: Entity) => void
  setToken: (token: string) => void
  setSessionChecked: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storage.getString('aim_token') ?? null,
  entity: (() => {
    try {
      const raw = storage.getString('aim_entity')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })(),
  sessionChecked: false,
  setAuth: (token, entity) => {
    storage.set('aim_token', token)
    storage.set('aim_entity', JSON.stringify(entity))
    set({ token, entity, sessionChecked: true })
  },
  setToken: (token) => {
    storage.set('aim_token', token)
    set({ token })
  },
  setSessionChecked: () => {
    set({ sessionChecked: true })
  },
  logout: () => {
    // Fire-and-forget: tell server to invalidate token
    const token = get().token
    if (token) {
      import('../lib/api').then((api) => api.logout(token)).catch(() => {})
    }
    storage.delete('aim_token')
    storage.delete('aim_entity')
    set({ token: null, entity: null })
  },
}))
