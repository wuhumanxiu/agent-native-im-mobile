/**
 * WebSocket hook — connects to ANI backend and dispatches real-time events
 * to Zustand stores. Mirrors the web app's useWebSocketManager.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../store/auth'
import { useConversationsStore } from '../store/conversations'
import { useMessagesStore } from '../store/messages'
import { usePresenceStore } from '../store/presence'
import { useTasksStore } from '../store/tasks'
import { AnimpWebSocket } from '../lib/ws-client'
import { WS_BASE_URL } from '../lib/constants'
import * as api from '../lib/api'
import type { WSMessage, Message, Task } from '../lib/types'

// ─── Typing Map ──────────────────────────────────────────────────

interface TypingEntry {
  name: string
  expiresAt: number
  isProcessing?: boolean
  phase?: string
}

export type TypingMap = Map<number, Map<number, TypingEntry>>

// ─── Hook ────────────────────────────────────────────────────────

export function useWebSocket() {
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const wsRef = useRef<AnimpWebSocket | null>(null)
  const [typingMap, setTypingMap] = useState<TypingMap>(new Map())

  const addMessage = useMessagesStore((s) => s.addMessage)
  const revokeMessage = useMessagesStore((s) => s.revokeMessage)
  const updateMessageReactions = useMessagesStore((s) => s.updateMessageReactions)
  const startStream = useMessagesStore((s) => s.startStream)
  const updateStream = useMessagesStore((s) => s.updateStream)
  const endStream = useMessagesStore((s) => s.endStream)
  const setProgress = useMessagesStore((s) => s.setProgress)
  const clearProgressBySender = useMessagesStore((s) => s.clearProgressBySender)

  const setConversations = useConversationsStore((s) => s.setConversations)
  const updateConversation = useConversationsStore((s) => s.updateConversation)
  const setActive = useConversationsStore((s) => s.setActive)
  const setReadReceipt = useConversationsStore((s) => s.setReadReceipt)

  const setOnline = usePresenceStore((s) => s.setOnline)
  const setWsConnected = usePresenceStore((s) => s.setWsConnected)

  useEffect(() => {
    if (!token || !entity) return

    const wsUrl = WS_BASE_URL || `wss://ani-web.51pwd.com`
    console.log('[WS] Connecting to:', wsUrl)
    const ws = new AnimpWebSocket(wsUrl, token)
    wsRef.current = ws

    const unsub = ws.onMessage((msg: WSMessage) => {
      switch (msg.type) {
        // ─── Presence ──────────────────────────────────
        case 'entity.online': {
          const data = msg.data as { self?: boolean; entity_id?: number }
          if (data?.self) {
            setWsConnected(true)
          } else if (data?.entity_id) {
            setOnline(data.entity_id, true)
          }
          break
        }
        case 'entity.offline': {
          const data = msg.data as { self?: boolean; entity_id?: number }
          if (data?.self) {
            setWsConnected(false)
          } else if (data?.entity_id) {
            setOnline(data.entity_id, false)
          }
          break
        }

        // ─── Messages ──────────────────────────────────
        case 'message.new': {
          const message = msg.data as Message
          console.log('[WS] message.new received:', message?.id, message?.conversation_id, message?.layers?.summary?.slice(0, 40))
          if (message?.conversation_id && message?.id) {
            addMessage(message)
            clearProgressBySender(message.conversation_id, message.sender_id)

            const currentActiveId = useConversationsStore.getState().activeId
            const isActive = message.conversation_id === currentActiveId
            const isSelf = message.sender_id === entity?.id
            if (!isActive && !isSelf) {
              const conv = useConversationsStore.getState().conversations.find(
                (c) => c.id === message.conversation_id,
              )
              updateConversation(message.conversation_id, {
                last_message: message,
                updated_at: message.created_at,
                unread_count: (conv?.unread_count || 0) + 1,
              })
            } else {
              updateConversation(message.conversation_id, {
                last_message: message,
                updated_at: message.created_at,
              })
            }
          }
          break
        }

        case 'message.revoked': {
          const data = msg.data as { message_id: number; conversation_id: number }
          if (data?.conversation_id && data?.message_id) {
            revokeMessage(data.conversation_id, data.message_id)
          }
          break
        }

        case 'message.reaction_updated': {
          const data = msg.data as {
            message_id: number
            conversation_id: number
            reactions: { emoji: string; count: number; entity_ids: number[] }[]
          }
          if (data?.conversation_id && data?.message_id) {
            updateMessageReactions(data.conversation_id, data.message_id, data.reactions)
          }
          break
        }

        case 'message.read': {
          const data = msg.data as {
            conversation_id?: number
            entity_id?: number
            message_id?: number
            last_read_at?: string
          }
          if (data?.conversation_id && data?.entity_id && data?.message_id) {
            setReadReceipt(
              data.conversation_id,
              data.entity_id,
              data.message_id,
              data.last_read_at || new Date().toISOString(),
            )
          }
          break
        }

        // ─── Conversation ──────────────────────────────
        case 'conversation.updated': {
          const convData = msg.data as {
            conversation_id?: number
            id?: number
            title?: string
            description?: string
            action?: string
            entity_id?: number
          }
          const convId = convData?.conversation_id || convData?.id
          if (convId) {
            if (
              (convData.action === 'member_removed' || convData.action === 'member_left') &&
              convData.entity_id === entity?.id
            ) {
              const convs = useConversationsStore.getState().conversations.filter(
                (c) => c.id !== convId,
              )
              setConversations(convs)
              if (useConversationsStore.getState().activeId === convId) {
                setActive(null)
              }
            } else {
              if (token) {
                api.getConversation(token, convId).then((res) => {
                  if (res.ok && res.data) {
                    updateConversation(convId, {
                      title: res.data.title,
                      description: res.data.description,
                      participants: res.data.participants,
                    })
                  }
                })
              }
            }
          }
          break
        }

        // ─── Tasks ─────────────────────────────────────
        case 'task.updated': {
          const taskData = msg.data as { action?: string; task?: Task; task_id?: number }
          if (taskData?.task) {
            const store = useTasksStore.getState()
            if (taskData.action === 'created') {
              store.addTask(taskData.task)
            } else if (taskData.action === 'updated') {
              store.updateTask(taskData.task)
            }
          } else if (taskData?.action === 'deleted' && taskData?.task_id) {
            const store = useTasksStore.getState()
            for (const [cId, tasks] of Object.entries(store.byConv)) {
              if (tasks.some((t) => t.id === taskData.task_id)) {
                store.removeTask(Number(cId), taskData.task_id!)
                break
              }
            }
          }
          break
        }

        // ─── Progress ──────────────────────────────────
        case 'message.progress': {
          const data = msg.data as {
            conversation_id?: number
            sender_id?: number
            stream_id?: string
            status?: { phase: string; progress: number; text: string }
          }
          if (data?.conversation_id && data?.sender_id) {
            setProgress(data.conversation_id, {
              conversation_id: data.conversation_id,
              sender_id: data.sender_id,
              stream_id: data.stream_id || '',
              status: data.status || { phase: 'working', progress: 0, text: '' },
              received_at: Date.now(),
            })
          }
          break
        }

        // ─── Typing ────────────────────────────────────
        case 'typing': {
          const typData = msg.data as {
            conversation_id?: number
            entity_id?: number
            entity_name?: string
            is_processing?: boolean
            phase?: string
          }
          if (typData?.conversation_id && typData?.entity_id && typData.entity_id !== entity?.id) {
            setTypingMap((prev) => {
              const next = new Map(prev)
              const convTyping = new Map(next.get(typData.conversation_id!) || [])
              convTyping.set(typData.entity_id!, {
                name: typData.entity_name || `User ${typData.entity_id}`,
                expiresAt: Date.now() + (typData.is_processing ? 30000 : 4000),
                isProcessing: typData.is_processing,
                phase: typData.phase,
              })
              next.set(typData.conversation_id!, convTyping)
              return next
            })
          }
          break
        }

        // ─── Streaming ─────────────────────────────────
        case 'stream_start': {
          if (msg.stream_id && msg.conversation_id && msg.sender_id) {
            startStream(msg.stream_id, msg.conversation_id, msg.sender_id, msg.layers || {})
          }
          break
        }

        case 'stream_delta': {
          if (msg.stream_id && msg.layers) {
            updateStream(msg.stream_id, msg.layers)
          }
          break
        }

        case 'stream_end': {
          if (msg.stream_id) {
            endStream(msg.stream_id, msg.message as Message)
          }
          break
        }

        case 'entity.config':
          break

        default:
          break
      }
    })

    // Keep sinceId in sync so reconnect requests catch-up from backend
    const syncSinceId = () => {
      ws.sinceId = useMessagesStore.getState().latestMessageId
    }
    const sinceIdInterval = setInterval(syncSinceId, 5000)
    syncSinceId()

    // On reconnect, refresh conversation list
    ws.onReconnect(() => {
      syncSinceId()
      api.listConversations(token).then((res) => {
        if (res.ok && res.data) {
          const convs = Array.isArray(res.data) ? res.data : []
          setConversations(convs)
        }
      })
    })

    const unsubConn = ws.onConnectionChange((connected) => {
      setWsConnected(connected)
    })

    ws.connect()

    // Stale stream & progress cleanup
    const cleanupInterval = setInterval(() => {
      useMessagesStore.getState().cleanStaleStreams()
      useMessagesStore.getState().cleanStaleProgress()
    }, 15000)

    return () => {
      unsub()
      unsubConn()
      clearInterval(sinceIdInterval)
      clearInterval(cleanupInterval)
      ws.disconnect()
      wsRef.current = null
      setWsConnected(false)
    }
  }, [token, entity])

  // ─── Typing indicator sender ───
  const sendTyping = useCallback((conversationId: number) => {
    wsRef.current?.send({
      type: 'typing',
      data: { conversation_id: conversationId },
    })
  }, [])

  // ─── Cancel stream ───
  const sendCancelStream = useCallback((streamId: string, conversationId: number) => {
    wsRef.current?.send({
      type: 'stream.cancel',
      data: { stream_id: streamId, conversation_id: conversationId },
    })
    endStream(streamId)
  }, [endStream])

  return { wsRef, typingMap, sendTyping, sendCancelStream }
}
