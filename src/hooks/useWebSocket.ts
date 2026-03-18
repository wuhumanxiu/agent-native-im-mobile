/**
 * WebSocket hook — connects to ANI backend and dispatches real-time events
 * to Zustand stores. Mirrors the web app's useWebSocketManager.
 */
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/auth'
import { useConversationsStore } from '../store/conversations'
import { useMessagesStore } from '../store/messages'
import { usePresenceStore } from '../store/presence'
import { AnimpWebSocket } from '../lib/ws-client'
import { WS_BASE_URL } from '../lib/constants'
import type { WSMessage, Message } from '../lib/types'

export function useWebSocket() {
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const wsRef = useRef<AnimpWebSocket | null>(null)

  const addMessage = useMessagesStore((s) => s.addMessage)
  const revokeMessage = useMessagesStore((s) => s.revokeMessage)
  const setConversations = useConversationsStore((s) => s.setConversations)
  const updateConversation = useConversationsStore((s) => s.updateConversation)
  const setOnline = usePresenceStore((s) => s.setOnline)
  const setWsConnected = usePresenceStore((s) => s.setWsConnected)

  useEffect(() => {
    if (!token || !entity) return

    const wsUrl = WS_BASE_URL || `wss://${typeof location !== 'undefined' ? location.host : 'ani-web.51pwd.com'}`
    const ws = new AnimpWebSocket(wsUrl, token)
    wsRef.current = ws
    ws.connect()

    const unsub = ws.onMessage((msg: WSMessage) => {
      switch (msg.type) {
        case 'entity.online': {
          const data = msg.data as { entity_id?: number }
          if (data?.entity_id) setOnline(data.entity_id, true)
          break
        }
        case 'entity.offline': {
          const data = msg.data as { entity_id?: number }
          if (data?.entity_id) setOnline(data.entity_id, false)
          break
        }
        case 'message.new': {
          const data = msg.data as Message
          if (data?.conversation_id && data?.id) {
            addMessage(data)
            // Update conversation's last message preview
            updateConversation(data.conversation_id, {
              updated_at: data.created_at,
            })
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
        case 'conversation.updated': {
          const data = msg.data as { id: number; title?: string }
          if (data?.id) {
            updateConversation(data.id, data)
          }
          break
        }
        default:
          break
      }
    })

    const unsubConn = ws.onConnectionChange((connected) => {
      setWsConnected(connected)
    })

    return () => {
      unsub()
      unsubConn()
      ws.disconnect()
      wsRef.current = null
      setWsConnected(false)
    }
  }, [token, entity])

  return wsRef
}
