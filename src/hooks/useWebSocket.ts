import { useEffect, useRef, useCallback } from 'react'
import { AppState } from 'react-native'
import { useAuthStore } from '../store/auth'
import { useConversationsStore } from '../store/conversations'
import { useMessagesStore } from '../store/messages'
import { usePresenceStore } from '../store/presence'
import * as api from '../lib/api'
import type { WSMessage, Message } from '../lib/types'

type TypingEntry = { name: string; expiresAt: number; isProcessing?: boolean; phase?: string }
type TypingMap = Map<number, Map<number, TypingEntry>>

export function useWebSocket() {
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const { updateConversation } = useConversationsStore()
  const { addMessage, revokeMessage, updateMessageReactions, startStream, updateStream, endStream, setProgress, clearProgressBySender } = useMessagesStore()
  const { setOnline, setWsConnected } = usePresenceStore()

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const typingMapRef = useRef<TypingMap>(new Map())

  const connect = useCallback(() => {
    if (!token || !entity) return

    const baseUrl = api.getBaseUrl()
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/v1/ws'

    const ws = new WebSocket(wsUrl, [], {
      headers: { Authorization: `Bearer ${token}` },
    } as unknown as string)

    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempts.current = 0
      // Send auth message
      ws.send(JSON.stringify({
        type: 'auth',
        token,
        device_info: 'ANI Mobile',
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string)
        handleMessage(msg)
      } catch {}
    }

    ws.onclose = () => {
      setWsConnected(false)
      scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }, [token, entity])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
    reconnectAttempts.current++
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null
      connect()
    }, delay)
  }, [connect])

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
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
      case 'message.new': {
        const message = msg.data as Message
        if (message) {
          addMessage(message)
          clearProgressBySender(message.conversation_id, message.sender_id)

          const currentActiveId = useConversationsStore.getState().activeId
          const isActive = message.conversation_id === currentActiveId
          const isSelf = message.sender_id === entity?.id
          if (!isActive && !isSelf) {
            const conv = useConversationsStore.getState().conversations.find((c) => c.id === message.conversation_id)
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
        if (data) revokeMessage(data.conversation_id, data.message_id)
        break
      }
      case 'message.reaction_updated': {
        const data = msg.data as { message_id: number; conversation_id: number; reactions: { emoji: string; count: number; entity_ids: number[] }[] }
        if (data) updateMessageReactions(data.conversation_id, data.message_id, data.reactions)
        break
      }
      case 'conversation.updated': {
        const data = msg.data as { conversation_id?: number; action?: string; entity_id?: number }
        if (data?.conversation_id && token) {
          if ((data.action === 'member_removed' || data.action === 'member_left') && data.entity_id === entity?.id) {
            const convs = useConversationsStore.getState().conversations.filter(c => c.id !== data.conversation_id)
            useConversationsStore.getState().setConversations(convs)
          } else {
            api.getConversation(token, data.conversation_id).then((res) => {
              if (res.ok && res.data) {
                updateConversation(data.conversation_id!, {
                  title: res.data.title,
                  description: res.data.description,
                  participants: res.data.participants,
                })
              }
            })
          }
        }
        break
      }
      case 'message.progress': {
        const data = msg.data as { conversation_id?: number; sender_id?: number; stream_id?: string; status?: { phase: string; progress: number; text: string } }
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
      case 'typing': {
        const data = msg.data as { conversation_id?: number; entity_id?: number; entity_name?: string; is_processing?: boolean; phase?: string }
        if (data?.conversation_id && data?.entity_id && data.entity_id !== entity?.id) {
          const convTyping = new Map(typingMapRef.current.get(data.conversation_id) || [])
          convTyping.set(data.entity_id, {
            name: data.entity_name || `User ${data.entity_id}`,
            expiresAt: Date.now() + (data.is_processing ? 30000 : 4000),
            isProcessing: data.is_processing,
            phase: data.phase,
          })
          typingMapRef.current.set(data.conversation_id, convTyping)
        }
        break
      }
      case 'stream_start':
        if (msg.stream_id && msg.conversation_id && msg.sender_id) {
          startStream(msg.stream_id, msg.conversation_id, msg.sender_id, msg.layers || {})
        }
        break
      case 'stream_delta':
        if (msg.stream_id && msg.layers) {
          updateStream(msg.stream_id, msg.layers)
        }
        break
      case 'stream_end':
        if (msg.stream_id) {
          endStream(msg.stream_id, msg.message as Message)
        }
        break
      case 'pong':
        break
    }
  }, [entity, token])

  const sendTyping = useCallback((conversationId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        data: { conversation_id: conversationId },
      }))
    }
  }, [])

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }))
    }
  }, [])

  // Connect on mount, reconnect on app foreground
  useEffect(() => {
    if (!token || !entity) return

    connect()

    const pingInterval = setInterval(sendPing, 25000)

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect()
        }
      }
    })

    // Stale stream/progress cleanup
    const cleanupInterval = setInterval(() => {
      useMessagesStore.getState().cleanStaleStreams()
      useMessagesStore.getState().cleanStaleProgress()
    }, 15000)

    return () => {
      clearInterval(pingInterval)
      clearInterval(cleanupInterval)
      subscription.remove()
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [token, entity, connect, sendPing])

  return { sendTyping, wsRef }
}
