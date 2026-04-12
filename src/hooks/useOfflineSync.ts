import { useEffect, useRef } from 'react'
import * as api from '../lib/api'
import { deleteOutboxMessage, listOutboxMessages, updateOutboxMessage } from '../lib/cache'
import { logDebugEvent } from '../lib/debug-telemetry'
import { isRetryableNetworkError, isRetryableNetworkResponse } from '../lib/errors'
import { useAuthStore } from '../store/auth'
import { useMessagesStore } from '../store/messages'
import { usePresenceStore } from '../store/presence'

export function useOfflineSync() {
  const token = useAuthStore((s) => s.token)
  const wsConnected = usePresenceStore((s) => s.wsConnected)
  const setLastSyncAt = usePresenceStore((s) => s.setLastSyncAt)
  const replaceOptimisticMessage = useMessagesStore((s) => s.replaceOptimisticMessage)
  const setOptimisticState = useMessagesStore((s) => s.setOptimisticState)
  const runningRef = useRef(false)

  useEffect(() => {
    if (!token || !wsConnected || runningRef.current) return

    let cancelled = false

    const flush = async () => {
      runningRef.current = true
      try {
        const queued = listOutboxMessages()
          .filter((item) => item.sync_state !== 'failed')
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
        if (queued.length > 0) {
          logDebugEvent('outbox.flush.start', { count: queued.length })
        }
        for (const item of queued) {
          if (cancelled) return
          setOptimisticState(item.temp_id, 'sending')
          updateOutboxMessage(item.id, {
            sync_state: 'sending',
            attempts: (item.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString(),
            last_error: '',
          })

          try {
            const res = await api.sendMessage(token, {
              conversation_id: item.conversation_id,
              content_type: item.content_type || 'text',
              layers: { summary: item.text },
              mentions: item.mentions,
              reply_to: item.reply_to,
            })

            if (res.ok && res.data) {
              logDebugEvent('outbox.flush.success', {
                conversationId: item.conversation_id,
                messageId: res.data.id,
              })
              replaceOptimisticMessage(item.temp_id, res.data)
              deleteOutboxMessage(item.id)
              setLastSyncAt(new Date().toISOString())
              continue
            }

            const nextState = isRetryableNetworkResponse(res) ? 'queued' : 'failed'
            logDebugEvent('outbox.flush.result', {
              conversationId: item.conversation_id,
              state: nextState,
              error: typeof res.error === 'string' ? res.error : res.error?.message,
            })
            setOptimisticState(item.temp_id, nextState)
            updateOutboxMessage(item.id, {
              sync_state: nextState,
              last_attempt_at: new Date().toISOString(),
              last_error: typeof res.error === 'string' ? res.error : 'sync_failed',
            })
            if (nextState === 'queued') return
          } catch (error) {
            const nextState = isRetryableNetworkError(error) ? 'queued' : 'failed'
            logDebugEvent('outbox.flush.exception', {
              conversationId: item.conversation_id,
              state: nextState,
              error: error instanceof Error ? error.message : 'sync_failed',
            })
            setOptimisticState(item.temp_id, nextState)
            updateOutboxMessage(item.id, {
              sync_state: nextState,
              last_attempt_at: new Date().toISOString(),
              last_error: error instanceof Error ? error.message : 'sync_failed',
            })
            return
          }
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
  }, [token, wsConnected, replaceOptimisticMessage, setOptimisticState, setLastSyncAt])
}
