import { create } from 'zustand'
import type { Entity } from '../lib/types'
import { hydrateStorage, storage } from '../lib/storage'

interface AuthState {
  token: string | null
  entity: Entity | null
  /** Whether we've attempted session restore on app launch */
  sessionChecked: boolean
  hydrate: () => Promise<void>
  setAuth: (token: string, entity: Entity) => void
  setToken: (token: string) => void
  setSessionChecked: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  entity: null,
  sessionChecked: false,
  hydrate: async () => {
    await hydrateStorage()
    try {
      const token = storage.getString('aim_token') ?? null
      const rawEntity = storage.getString('aim_entity') ?? null
      let entity: Entity | null = null
      if (rawEntity) {
        try {
          entity = JSON.parse(rawEntity) as Entity
        } catch {
          entity = null
        }
      }

      set({ token, entity, sessionChecked: true })
    } catch {
      const token = storage.getString('aim_token') ?? null
      let entity: Entity | null = null
      try {
        const raw = storage.getString('aim_entity')
        entity = raw ? JSON.parse(raw) as Entity : null
      } catch {
        entity = null
      }
      set({ token, entity, sessionChecked: true })
    }
  },
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
