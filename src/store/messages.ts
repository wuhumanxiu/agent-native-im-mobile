import { create } from 'zustand'
import type { Message, ActiveStream, MessageLayers, ReactionSummary, StreamStatus } from '../lib/types'

// Transient progress indicator for a conversation (not persisted)
export interface ProgressEntry {
  conversation_id: number
  sender_id: number
  stream_id: string
  status: StreamStatus
  received_at: number
}

interface MessagesState {
  // convId -> messages (newest last)
  byConv: Record<number, Message[]>
  hasMore: Record<number, boolean>
  // active streams (transient)
  streams: Record<string, ActiveStream>
  // optimistic messages (tempId -> message)
  optimistic: Record<string, Message>
  // transient progress indicators (convId -> ProgressEntry)
  progress: Record<number, ProgressEntry>
  // highest message ID seen (for reconnect catch-up)
  latestMessageId: number

  setMessages: (convId: number, msgs: Message[], hasMore: boolean) => void
  prependMessages: (convId: number, msgs: Message[], hasMore: boolean) => void
  addMessage: (msg: Message) => void
  revokeMessage: (convId: number, msgId: number) => void
  mergeMessages: (convId: number, msgs: Message[]) => void

  // optimistic messages
  addOptimisticMessage: (tempId: string, msg: Message) => void
  replaceOptimisticMessage: (tempId: string, msg: Message) => void
  clearSentState: (tempId: string) => void
  removeOptimisticMessage: (tempId: string, convId: number) => void
  setOptimisticState: (tempId: string, state: 'sending' | 'sent' | 'queued' | 'failed') => void

  // reactions
  updateMessageReactions: (convId: number, msgId: number, reactions: ReactionSummary[]) => void

  // streaming
  startStream: (streamId: string, convId: number, senderId: number, layers: MessageLayers) => void
  updateStream: (streamId: string, layers: MessageLayers) => void
  endStream: (streamId: string, message?: Message) => void
  cleanStaleStreams: () => void

  // progress indicators
  setProgress: (convId: number, entry: ProgressEntry) => void
  clearProgress: (convId: number) => void
  clearProgressBySender: (convId: number, senderId: number) => void
  cleanStaleProgress: () => void
}

export const useMessagesStore = create<MessagesState>((set) => ({
  byConv: {},
  hasMore: {},
  streams: {},
  optimistic: {},
  progress: {},
  latestMessageId: 0,

  setMessages: (convId, msgs, hasMore) =>
    set((s) => {
      const maxId = msgs.reduce((max, m) => Math.max(max, m.id ?? 0), s.latestMessageId)
      return {
        byConv: { ...s.byConv, [convId]: msgs },
        hasMore: { ...s.hasMore, [convId]: hasMore },
        latestMessageId: maxId,
      }
    }),

  prependMessages: (convId, msgs, hasMore) =>
    set((s) => {
      const existing = s.byConv[convId] || []
      const existingIds = new Set(existing.map((m) => m.id))
      const unique = msgs.filter((m) => !existingIds.has(m.id))
      return {
      byConv: { ...s.byConv, [convId]: [...unique, ...existing] },
      hasMore: { ...s.hasMore, [convId]: hasMore },
    }}),

  addMessage: (msg) =>
    set((s) => {
      const existing = s.byConv[msg.conversation_id] || []

      // Check for duplicate by ID
      if (existing.some((m) => m.id === msg.id)) return s

      // Check if there's an optimistic message that matches this real message
      const optimisticMatches = Object.values(s.optimistic).filter(
        opt => opt.conversation_id === msg.conversation_id &&
               opt.sender_id === msg.sender_id &&
               Math.abs(new Date(opt.created_at).getTime() - new Date(msg.created_at).getTime()) < 5000 &&
               (opt.layers?.summary || '').trim() === (msg.layers?.summary || '').trim()
      )

      // If we found a matching optimistic message, don't add the WebSocket message
      if (optimisticMatches.length > 0) return s

      const newLatest = Math.max(s.latestMessageId, msg.id ?? 0)
      return {
        byConv: { ...s.byConv, [msg.conversation_id]: [...existing, msg] },
        latestMessageId: newLatest,
      }
    }),

  revokeMessage: (convId, msgId) =>
    set((s) => ({
      byConv: {
        ...s.byConv,
        [convId]: (s.byConv[convId] || []).map((m) =>
          m.id === msgId ? { ...m, revoked_at: new Date().toISOString() } : m
        ),
      },
    })),

  mergeMessages: (convId, msgs) =>
    set((s) => {
      const existing = s.byConv[convId] || []
      const merged = [...existing]
      const seenIds = new Set<number>()
      const seenTempIds = new Set<string>()

      for (const item of existing) {
        if (typeof item.id === 'number') seenIds.add(item.id)
        if (item.temp_id) seenTempIds.add(item.temp_id)
      }

      for (const msg of msgs) {
        if ((typeof msg.id === 'number' && seenIds.has(msg.id)) || (msg.temp_id && seenTempIds.has(msg.temp_id))) {
          continue
        }
        merged.push(msg)
        if (typeof msg.id === 'number') seenIds.add(msg.id)
        if (msg.temp_id) seenTempIds.add(msg.temp_id)
      }

      merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const latestMessageId = merged.reduce((max, m) => Math.max(max, m.id ?? 0), s.latestMessageId)
      return {
        byConv: { ...s.byConv, [convId]: merged },
        latestMessageId,
      }
    }),

  addOptimisticMessage: (tempId, msg) =>
    set((s) => {
      const existing = s.byConv[msg.conversation_id] || []
      const optimisticMsg = { ...msg, temp_id: tempId, client_state: 'sending' as const }
      return {
        optimistic: { ...s.optimistic, [tempId]: optimisticMsg },
        byConv: { ...s.byConv, [msg.conversation_id]: [...existing, optimisticMsg] },
      }
    }),

  replaceOptimisticMessage: (tempId, msg) =>
    set((s) => {
      const optimisticMsg = s.optimistic[tempId]
      if (!optimisticMsg) return s

      const convId = optimisticMsg.conversation_id
      const messages = s.byConv[convId] || []
      const sentMsg = { ...msg, temp_id: tempId, client_state: 'sent' as const }
      const updatedMessages = messages.map((m) =>
        m.id === optimisticMsg.id ? sentMsg : m
      )

      return {
        optimistic: { ...s.optimistic, [tempId]: sentMsg },
        byConv: { ...s.byConv, [convId]: updatedMessages },
      }
    }),

  clearSentState: (tempId: string) =>
    set((s) => {
      const optimisticMsg = s.optimistic[tempId]
      if (!optimisticMsg) return s

      const convId = optimisticMsg.conversation_id
      const messages = s.byConv[convId] || []
      const { temp_id: _t, client_state: _c, ...cleanMsg } = optimisticMsg
      const updatedMessages = messages.map((m) =>
        m.temp_id === tempId ? cleanMsg : m
      )

      const { [tempId]: _, ...restOptimistic } = s.optimistic
      return {
        optimistic: restOptimistic,
        byConv: { ...s.byConv, [convId]: updatedMessages },
      }
    }),

  removeOptimisticMessage: (tempId, convId) =>
    set((s) => {
      const optimisticMsg = s.optimistic[tempId]
      if (!optimisticMsg) return s

      const messages = s.byConv[convId] || []
      const updatedMessages = messages.filter((m) => m.id !== optimisticMsg.id)

      const { [tempId]: _, ...restOptimistic } = s.optimistic
      return {
        optimistic: restOptimistic,
        byConv: { ...s.byConv, [convId]: updatedMessages },
      }
    }),

  setOptimisticState: (tempId, state) =>
    set((s) => {
      const optimisticMsg = s.optimistic[tempId]
      if (!optimisticMsg) return s

      const convId = optimisticMsg.conversation_id
      const messages = s.byConv[convId] || []
      const updatedMsg = { ...optimisticMsg, client_state: state }
      return {
        optimistic: { ...s.optimistic, [tempId]: updatedMsg },
        byConv: {
          ...s.byConv,
          [convId]: messages.map((m) => (m.id === optimisticMsg.id ? updatedMsg : m)),
        },
      }
    }),

  updateMessageReactions: (convId, msgId, reactions) =>
    set((s) => ({
      byConv: {
        ...s.byConv,
        [convId]: (s.byConv[convId] || []).map((m) =>
          m.id === msgId ? { ...m, reactions } : m
        ),
      },
    })),

  startStream: (streamId, convId, senderId, layers) =>
    set((s) => ({
      streams: {
        ...s.streams,
        [streamId]: { stream_id: streamId, conversation_id: convId, sender_id: senderId, layers, started_at: Date.now() },
      },
    })),

  updateStream: (streamId, layers) =>
    set((s) => {
      const existing = s.streams[streamId]
      if (!existing) return s
      return {
        streams: {
          ...s.streams,
          [streamId]: { ...existing, layers: { ...existing.layers, ...layers } },
        },
      }
    }),

  endStream: (streamId, message) =>
    set((s) => {
      const { [streamId]: _, ...rest } = s.streams
      if (!message) return { streams: rest }
      const existing = s.byConv[message.conversation_id] || []
      if (existing.some((m) => m.id === message.id)) return { streams: rest }
      return {
        streams: rest,
        byConv: { ...s.byConv, [message.conversation_id]: [...existing, message] },
        latestMessageId: message ? Math.max(s.latestMessageId, message.id ?? 0) : s.latestMessageId,
      }
    }),

  setProgress: (convId, entry) =>
    set((s) => ({
      progress: { ...s.progress, [convId]: entry },
    })),

  clearProgress: (convId) =>
    set((s) => {
      const { [convId]: _, ...rest } = s.progress
      return { progress: rest }
    }),

  clearProgressBySender: (convId, senderId) =>
    set((s) => {
      const existing = s.progress[convId]
      if (!existing || existing.sender_id !== senderId) return s
      const { [convId]: _, ...rest } = s.progress
      return { progress: rest }
    }),

  cleanStaleProgress: () =>
    set((s) => {
      const now = Date.now()
      const keys = Object.keys(s.progress)
      if (keys.length === 0) return s
      const staleKeys = keys.filter((k) => now - s.progress[Number(k)].received_at >= 30_000)
      if (staleKeys.length === 0) return s
      const fresh: Record<number, ProgressEntry> = {}
      for (const [k, v] of Object.entries(s.progress)) {
        if (now - v.received_at < 30_000) fresh[Number(k)] = v
      }
      return { progress: fresh }
    }),

  cleanStaleStreams: () =>
    set((s) => {
      const now = Date.now()
      const staleIds = Object.keys(s.streams).filter(
        (id) => now - s.streams[id].started_at > 120_000
      )
      if (staleIds.length === 0) return s
      if (__DEV__) {
        console.debug('[streams] cleaning stale streams:', staleIds)
      }
      const streams = { ...s.streams }
      for (const id of staleIds) {
        streams[id] = {
          ...streams[id],
          layers: {
            ...streams[id].layers,
            status: { phase: 'error', progress: 0, text: 'Timed out' },
          },
        }
      }
      // Remove after a brief display period (clean up on next cycle)
      const removeIds = Object.keys(s.streams).filter(
        (id) => now - s.streams[id].started_at > 135_000
      )
      for (const id of removeIds) delete streams[id]
      return { streams }
    }),
}))
