import { useEffect, useState, useCallback } from 'react'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/store/auth'
import { useConversationsStore } from '../../src/store/conversations'
import { useMessagesStore } from '../../src/store/messages'
import * as api from '../../src/lib/api'
import type { Conversation, Message } from '../../src/lib/types'
import { ChatThread } from '../../src/components/chat/ChatThread'

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const convId = Number(id)
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const messages = useMessagesStore((s) => s.byConv[convId] ?? [])
  const setMessages = useMessagesStore((s) => s.setMessages)
  const [loading, setLoading] = useState(true)

  const conversation = conversations.find((c) => c.id === convId) || null

  // Load messages
  useEffect(() => {
    if (!token || !convId) return
    setLoading(true)
    api.listMessages(token, convId).then((res) => {
      if (res.ok && res.data) {
        const msgs = Array.isArray(res.data) ? res.data : (res.data as any).messages || []
        setMessages(convId, msgs)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [token, convId, setMessages])

  // Send message
  const handleSend = useCallback(async (text: string) => {
    if (!token || !text.trim()) return
    await api.sendMessage(token, convId, { layers: { summary: text } })
    // Reload messages
    const res = await api.listMessages(token, convId)
    if (res.ok && res.data) {
      const msgs = Array.isArray(res.data) ? res.data : (res.data as any).messages || []
      setMessages(convId, msgs)
    }
  }, [token, convId, setMessages])

  if (!conversation || !entity) return null

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['bottom']}>
        <ChatThread
          conversation={conversation}
          messages={messages}
          myEntityId={entity.id}
          myEntity={entity}
          loading={loading}
          onBack={() => router.back()}
          onSend={handleSend}
        />
      </SafeAreaView>
    </>
  )
}
