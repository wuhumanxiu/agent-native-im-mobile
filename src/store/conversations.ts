import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Conversation } from '../lib/types'

const MUTED_KEY = 'aim_muted_convs'

function loadMutedIds(): Set<number> {
  return new Set()
}

function saveMutedIds(ids: Set<number>) {
  AsyncStorage.setItem(MUTED_KEY, JSON.stringify([...ids])).catch(() => {})
}

interface ConversationsState {
  conversations: Conversation[]
  activeId: number | null
  mutedIds: Set<number>
  setConversations: (convs: Conversation[]) => void
  setActive: (id: number | null) => void
  updateConversation: (id: number, partial: Partial<Conversation>) => void
  addConversation: (conv: Conversation) => void
  removeConversation: (id: number) => void
  toggleMute: (id: number) => void
  isMuted: (id: number) => boolean
  hydrateMuted: () => Promise<void>
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: [],
  activeId: null,
  mutedIds: loadMutedIds(),

  setConversations: (conversations) => set({ conversations }),

  setActive: (activeId) => {
    set({ activeId })
  },

  updateConversation: (id, partial) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.id === id)
      if (idx === -1) return s
      const updated = [...s.conversations]
      updated[idx] = { ...updated[idx], ...partial }
      return { conversations: updated }
    }),

  addConversation: (conv) =>
    set((s) => ({
      conversations: [conv, ...s.conversations.filter((c) => c.id !== conv.id)],
    })),

  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    })),

  toggleMute: (id) => {
    set((s) => {
      const next = new Set(s.mutedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveMutedIds(next)
      return { mutedIds: next }
    })
  },

  isMuted: (id) => get().mutedIds.has(id),

  hydrateMuted: async () => {
    try {
      const raw = await AsyncStorage.getItem(MUTED_KEY)
      if (raw) {
        set({ mutedIds: new Set(JSON.parse(raw)) })
      }
    } catch {}
  },
}))
