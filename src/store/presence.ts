import { create } from 'zustand'

interface PresenceState {
  online: Set<number>
  wsConnected: boolean
  lastSyncAt: string | null
  setOnline: (entityId: number, isOnline: boolean) => void
  setPresenceBatch: (entityIds: number[], onlineIds: number[]) => void
  setWsConnected: (connected: boolean) => void
  setLastSyncAt: (timestamp: string | null) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  online: new Set<number>(),
  wsConnected: false,
  lastSyncAt: null,
  setOnline: (entityId, isOnline) =>
    set((s) => {
      const next = new Set(s.online)
      if (isOnline) next.add(entityId)
      else next.delete(entityId)
      return { online: next }
    }),
  setPresenceBatch: (entityIds, onlineIds) =>
    set((s) => {
      const next = new Set(s.online)
      for (const id of entityIds) next.delete(id)
      for (const id of onlineIds) next.add(id)
      return { online: next }
    }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}))
