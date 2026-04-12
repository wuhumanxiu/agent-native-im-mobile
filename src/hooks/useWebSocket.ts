/**
 * WebSocket hook — connects to ANI backend and dispatches real-time events
 * to Zustand stores. Mirrors the web app's useWebSocketManager.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../store/auth'
import { useConversationsStore } from '../store/conversations'
import { useMessagesStore } from '../store/messages'
import { useNotificationsStore } from '../store/notifications'
import { usePresenceStore } from '../store/presence'
import { useTasksStore } from '../store/tasks'
import { AnimpWebSocket } from '../lib/ws-client'
import { logDebugEvent } from '../lib/debug-telemetry'
import { getWsBaseUrl } from '../lib/gateway'
import * as api from '../lib/api'
import type { WSMessage, Message, Task } from '../lib/types'

const WS_RELEASE_DELAY_MS = 5000

type SharedSocket = {
  token: string
  ws: AnimpWebSocket
  refs: number
  releaseTimer: ReturnType<typeof setTimeout> | null
}

let sharedSocket: SharedSocket | null = null

function acquireSharedSocket(token: string): AnimpWebSocket {
  if (sharedSocket && sharedSocket.token === token) {
    if (sharedSocket.releaseTimer) {
      clearTimeout(sharedSocket.releaseTimer)
      sharedSocket.releaseTimer = null
    }
    sharedSocket.refs += 1
    return sharedSocket.ws
  }

  if (sharedSocket) {
    if (sharedSocket.releaseTimer) clearTimeout(sharedSocket.releaseTimer)
    sharedSocket.ws.disconnect()
    sharedSocket = null
  }

  const wsUrl = getWsBaseUrl() || 'wss://agent-native.im'
  sharedSocket = {
    token,
    ws: new AnimpWebSocket(wsUrl, token),
    refs: 1,
    releaseTimer: null,
  }
  sharedSocket.ws.connect()
  return sharedSocket.ws
}

function releaseSharedSocket(ws: AnimpWebSocket) {
  if (!sharedSocket || sharedSocket.ws !== ws) return
  sharedSocket.refs = Math.max(0, sharedSocket.refs - 1)
  if (sharedSocket.refs > 0) return
  sharedSocket.releaseTimer = setTimeout(() => {
    if (!sharedSocket || sharedSocket.ws !== ws || sharedSocket.refs > 0) return
    sharedSocket.ws.disconnect()
    sharedSocket = null
  }, WS_RELEASE_DELAY_MS)
}

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
  const entityId = useAuthStore((s) => s.entity?.id)
  const setToken = useAuthStore((s) => s.setToken)
  const logout = useAuthStore((s) => s.logout)
  const wsRef = useRef<AnimpWebSocket | null>(null)
  const lastWSRefreshAttemptRef = useRef(0)
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
  const upsertNotification = useNotificationsStore((s) => s.upsertNotification)
  const applyNotificationReadById = useNotificationsStore((s) => s.applyNotificationReadById)
  const applyNotificationReadAll = useNotificationsStore((s) => s.applyNotificationReadAll)
  const upsertFriendRequest = useNotificationsStore((s) => s.upsertFriendRequest)
  const removeFriendRequest = useNotificationsStore((s) => s.removeFriendRequest)

  const decodeJwtExp = useCallback((jwtToken: string): number | null => {
    const parts = jwtToken.split('.')
    if (parts.length < 2) return null
    try {
      if (typeof atob !== 'function') return null
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      const payload = JSON.parse(atob(padded))
      return typeof payload.exp === 'number' ? payload.exp : null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!token || !entityId) return

    const refreshIfNeeded = async () => {
      const exp = decodeJwtExp(useAuthStore.getState().token || '')
      if (!exp) return
      const nowSec = Math.floor(Date.now() / 1000)
      if (exp - nowSec > 1800) return
      const currentToken = useAuthStore.getState().token
      if (!currentToken) return
      logDebugEvent('auth.refresh.proactive.attempt', { exp })
      const res = await api.refreshToken(currentToken)
      if (res.ok && res.data?.token) {
        logDebugEvent('auth.refresh.proactive.success')
        setToken(res.data.token)
      } else {
        logDebugEvent('auth.refresh.proactive.failed', {
          error: typeof res.error === 'string' ? res.error : res.error?.message,
        })
        logout()
      }
    }

    const timer = setInterval(refreshIfNeeded, 5 * 60 * 1000)
    void refreshIfNeeded()
    return () => clearInterval(timer)
  }, [decodeJwtExp, entityId, logout, setToken, token])

  useEffect(() => {
    if (!token || !entityId) return

    const ws = acquireSharedSocket(token)
    wsRef.current = ws

    const unsub = ws.onMessage((msg: WSMessage) => {
      switch (msg.type) {
        // ─── Presence ──────────────────────────────────
        case 'entity.online': {
          const data = msg.data as { self?: boolean; entity_id?: number }
          if (data?.self) {
            logDebugEvent('ws.self.online')
            setWsConnected(true)
          } else if (data?.entity_id) {
            setOnline(data.entity_id, true)
          }
          break
        }
        case 'entity.offline': {
          const data = msg.data as { self?: boolean; entity_id?: number }
          if (data?.self) {
            logDebugEvent('ws.self.offline')
            setWsConnected(false)
          } else if (data?.entity_id) {
            setOnline(data.entity_id, false)
          }
          break
        }

        // ─── Messages ──────────────────────────────────
        case 'message.new': {
          const message = msg.data as Message
          if (message?.conversation_id && message?.id) {
            addMessage(message)
            clearProgressBySender(message.conversation_id, message.sender_id)

            const currentActiveId = useConversationsStore.getState().activeId
            const isActive = message.conversation_id === currentActiveId
            const isSelf = message.sender_id === entityId
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
              convData.entity_id === entityId
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
          if (typData?.conversation_id && typData?.entity_id && typData.entity_id !== entityId) {
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

        case 'friend.request.created': {
          const request = msg.data as import('../lib/types').FriendRequest
          if (request?.id) upsertFriendRequest(request)
          break
        }

        case 'friend.request.updated': {
          const request = msg.data as import('../lib/types').FriendRequest
          if (!request?.id) break
          if (request.status === 'pending') upsertFriendRequest(request)
          else removeFriendRequest(request.id)
          break
        }

        case 'notification.new': {
          const notification = msg.data as import('../lib/types').NotificationRecord
          if (notification?.id) upsertNotification(notification)
          break
        }

        case 'notification.read': {
          const data = msg.data as { notification_id?: number; recipient_entity_id?: number }
          if (data?.notification_id) applyNotificationReadById(data.notification_id, data.recipient_entity_id)
          break
        }

        case 'notification.read_all': {
          const data = msg.data as { recipient_entity_id?: number }
          applyNotificationReadAll(data?.recipient_entity_id)
          break
        }

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
      logDebugEvent('ws.reconnect', { sinceId: useMessagesStore.getState().latestMessageId })
      syncSinceId()
      api.listConversations(token).then((res) => {
        if (res.ok && res.data) {
          const convs = Array.isArray(res.data) ? res.data : []
          setConversations(convs)
        }
      })
    })

    const unsubConn = ws.onConnectionChange((connected) => {
      logDebugEvent('ws.connection.change', { connected })
      setWsConnected(connected)
    })

    const unsubAuthFailure = ws.onAuthFailure(async () => {
      logDebugEvent('ws.auth.failure')
      const now = Date.now()
      if (now - lastWSRefreshAttemptRef.current < 15000) return
      lastWSRefreshAttemptRef.current = now

      const currentToken = useAuthStore.getState().token
      if (!currentToken) return
      const exp = decodeJwtExp(currentToken)
      const nowSec = Math.floor(now / 1000)
      if (exp && exp - nowSec > 300) return

      const res = await api.refreshToken(currentToken)
      if (res.ok && res.data?.token) {
        logDebugEvent('ws.auth.refresh.success')
        setToken(res.data.token)
        return
      }

      const errMsg = typeof res.error === 'string'
        ? res.error
        : (res.error?.message || '')
      logDebugEvent('ws.auth.refresh.failed', { error: errMsg || 'unknown' })
      if (errMsg && (
        errMsg.toLowerCase().includes('invalid token') ||
        errMsg.toLowerCase().includes('missing authorization') ||
        errMsg.toLowerCase().includes('disabled') ||
        errMsg.toLowerCase().includes('forbidden')
      )) {
        logout()
      }
    })

    // Stale stream & progress cleanup
    const cleanupInterval = setInterval(() => {
      useMessagesStore.getState().cleanStaleStreams()
      useMessagesStore.getState().cleanStaleProgress()
    }, 15000)

    return () => {
      unsub()
      unsubConn()
      unsubAuthFailure()
      clearInterval(sinceIdInterval)
      clearInterval(cleanupInterval)
      wsRef.current = null
      releaseSharedSocket(ws)
    }
  }, [addMessage, applyNotificationReadAll, applyNotificationReadById, clearProgressBySender, decodeJwtExp, endStream, entityId, logout, removeFriendRequest, revokeMessage, setConversations, setOnline, setProgress, setReadReceipt, setToken, setWsConnected, startStream, token, updateConversation, updateMessageReactions, updateStream, upsertFriendRequest, upsertNotification])

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
