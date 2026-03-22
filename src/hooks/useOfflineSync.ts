import { useEffect, useRef } from 'react'
import * as api from '../lib/api'
import { deleteOutboxMessage, listOutboxMessages, updateOutboxMessage } from '../lib/cache'
import { useAuthStore } from '../store/auth'
import { useMessagesStore } from '../store/messages'
import { usePresenceStore } from '../store/presence'

export function useOfflineSync() {
  const token = useAuthStore((s) => s.token)
  const wsConnected = usePresenceStore((s) => s.wsConnected)
  const replaceOptimisticMessage = useMessagesStore((s) => s.replaceOptimisticMessage)
  const setOptimisticState = useMessagesStore((s) => s.setOptimisticState)
  const runningRef = useRef(false)

  useEffect(() => {
    if (!token || !wsConnected || runningRef.current) return

    let cancelled = false

    const flush = async () => {
      runningRef.current = true
      try {
        const queued = listOutboxMessages().sort((a, b) => a.created_at.localeCompare(b.created_at))
        for (const item of queued) {
          if (cancelled) return
          setOptimisticState(item.temp_id, 'sending')
          updateOutboxMessage(item.id, {
            sync_state: 'sending',
            attempts: (item.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString(),
            last_error: '',
          })

          const res = await api.sendMessage(token, {
            conversation_id: item.conversation_id,
            content_type: item.content_type || 'text',
            layers: { summary: item.text },
            mentions: item.mentions,
            reply_to: item.reply_to,
          })

          if (res.ok && res.data) {
            replaceOptimisticMessage(item.temp_id, res.data)
            deleteOutboxMessage(item.id)
            continue
          }

          setOptimisticState(item.temp_id, 'failed')
          updateOutboxMessage(item.id, {
            sync_state: 'failed',
            last_attempt_at: new Date().toISOString(),
            last_error: typeof res.error === 'string' ? res.error : 'sync_failed',
          })
        }
      } finally {
        runningRef.current = false
      }
    }

    void flush()
    const interval = setInterval(() => {
      if (!runningRef.current) void flush()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [token, wsConnected, replaceOptimisticMessage, setOptimisticState])
}

