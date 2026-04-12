import { create } from 'zustand'
import type { PresenceStateValue } from '../lib/types'

interface PresenceState {
  online: Set<number>
  known: Set<number>
  wsConnected: boolean
  lastSyncAt: string | null
  getPresenceState: (entityId?: number | null) => PresenceStateValue
  setOnline: (entityId: number, isOnline: boolean) => void
  setPresenceBatch: (entityIds: number[], onlineIds: number[]) => void
  setPresenceUnknown: (entityIds: number[]) => void
  setWsConnected: (connected: boolean) => void
  setLastSyncAt: (timestamp: string | null) => void
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  online: new Set<number>(),
  known: new Set<number>(),
  wsConnected: false,
  lastSyncAt: null,
  getPresenceState: (entityId) => {
    if (entityId == null) return 'unknown'
    if (!get().known.has(entityId)) return 'unknown'
    return get().online.has(entityId) ? 'online' : 'offline'
  },
  setOnline: (entityId, isOnline) =>
    set((s) => {
      const next = new Set(s.online)
      const known = new Set(s.known)
      if (isOnline) next.add(entityId)
      else next.delete(entityId)
      known.add(entityId)
      return { online: next, known }
    }),
  setPresenceBatch: (entityIds, onlineIds) =>
    set((s) => {
      const next = new Set(s.online)
      const known = new Set(s.known)
      for (const id of entityIds) next.delete(id)
      for (const id of entityIds) known.add(id)
      for (const id of onlineIds) next.add(id)
      return { online: next, known, lastSyncAt: new Date().toISOString() }
    }),
  setPresenceUnknown: (entityIds) =>
    set((s) => {
      const next = new Set(s.online)
      const known = new Set(s.known)
      for (const id of entityIds) {
        next.delete(id)
        known.delete(id)
      }
      return { online: next, known }
    }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}))
