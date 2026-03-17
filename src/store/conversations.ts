import { create } from 'zustand'
import type { Conversation } from '../lib/types'
import { storage } from '../lib/storage'

// Load muted IDs from MMKV
function loadMutedIds(): Set<number> {
  try {
    const raw = storage.getString('aim_muted_convs')
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* storage unavailable */ }
  return new Set()
}

function saveMutedIds(ids: Set<number>) {
  storage.set('aim_muted_convs', JSON.stringify([...ids]))
}

export interface ReadReceipt {
  entityId: number
  messageId: number
  lastReadAt: string
}

// readReceipts: conversationId -> entityId -> ReadReceipt
type ReadReceiptsMap = Record<number, Record<number, ReadReceipt>>

interface ConversationsState {
  conversations: Conversation[]
  activeId: number | null
  mutedIds: Set<number>
  readReceipts: ReadReceiptsMap
  setConversations: (convs: Conversation[]) => void
  setActive: (id: number | null) => void
  updateConversation: (id: number, partial: Partial<Conversation>) => void
  addConversation: (conv: Conversation) => void
  removeConversation: (id: number) => void
  toggleMute: (id: number) => void
  isMuted: (id: number) => boolean
  setReadReceipt: (conversationId: number, entityId: number, messageId: number, lastReadAt: string) => void
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: [],
  activeId: null,
  mutedIds: loadMutedIds(),
  readReceipts: {},
  setConversations: (conversations) => set({ conversations }),
  setActive: (activeId) => {
    set({ activeId })
  },
  updateConversation: (id, partial) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.id === id)
      if (idx === -1) return s // no-op if conversation not in list
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
  setReadReceipt: (conversationId, entityId, messageId, lastReadAt) =>
    set((s) => {
      const convReceipts = { ...s.readReceipts[conversationId] }
      const existing = convReceipts[entityId]
      // Only update if this is a newer read receipt
      if (existing && existing.messageId >= messageId) return s
      convReceipts[entityId] = { entityId, messageId, lastReadAt }
      return { readReceipts: { ...s.readReceipts, [conversationId]: convReceipts } }
    }),
}))
