import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Entity } from '../lib/types'

const TOKEN_KEY = 'aim_token'
const ENTITY_KEY = 'aim_entity'

interface AuthState {
  token: string | null
  entity: Entity | null
  hydrated: boolean
  setAuth: (token: string, entity: Entity) => void
  setToken: (token: string) => void
  setEntity: (entity: Entity) => void
  logout: () => void
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  entity: null,
  hydrated: false,

  setAuth: (token, entity) => {
    SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {})
    AsyncStorage.setItem(ENTITY_KEY, JSON.stringify(entity)).catch(() => {})
    set({ token, entity })
  },

  setToken: (token) => {
    SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {})
    set({ token })
  },

  setEntity: (entity) => {
    AsyncStorage.setItem(ENTITY_KEY, JSON.stringify(entity)).catch(() => {})
    set({ entity })
  },

  logout: () => {
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {})
    AsyncStorage.removeItem(ENTITY_KEY).catch(() => {})
    set({ token: null, entity: null })
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY)
      const entityJson = await AsyncStorage.getItem(ENTITY_KEY)
      const entity = entityJson ? JSON.parse(entityJson) : null
      set({ token, entity, hydrated: true })
    } catch {
      set({ hydrated: true })
    }
  },
}))
