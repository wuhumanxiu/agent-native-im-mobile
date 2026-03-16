import { create } from 'zustand'

interface PresenceState {
  online: Set<number>
  wsConnected: boolean
  setOnline: (entityId: number, isOnline: boolean) => void
  setWsConnected: (connected: boolean) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  online: new Set<number>(),
  wsConnected: false,
  setOnline: (entityId, isOnline) =>
    set((s) => {
      const next = new Set(s.online)
      if (isOnline) next.add(entityId)
      else next.delete(entityId)
      return { online: next }
    }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
}))
