import { useEffect, useState, useCallback } from 'react'
import { View, Modal, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/store/auth'
import { useConversationsStore } from '../../src/store/conversations'
import * as api from '../../src/lib/api'
import type { Message, Conversation } from '../../src/lib/types'
import { ChatThread } from '../../src/components/chat/ChatThread'
import { ConversationSettings } from '../../src/components/conversation/ConversationSettings'
import { TaskPanel } from '../../src/components/task/TaskPanel'

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const convId = Number(id)
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const updateConversation = useConversationsStore((s) => s.updateConversation)
  const removeConversation = useConversationsStore((s) => s.removeConversation)

  const [conversation, setConversation] = useState<Conversation | null>(
    conversations.find((c) => c.id === convId) || null,
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showTasks, setShowTasks] = useState(false)

  // Load conversation detail if not in store
  useEffect(() => {
    if (!token || !convId) return
    const fromStore = conversations.find((c) => c.id === convId)
    if (fromStore) {
      setConversation(fromStore)
    } else {
      api.getConversation(token, convId).then((res) => {
        if (res.ok && res.data) setConversation(res.data)
      }).catch(() => {})
    }
  }, [token, convId, conversations])

  // Load messages
  useEffect(() => {
    if (!token || !convId) return
    setLoading(true)
    api.listMessages(token, convId).then((res) => {
      if (res.ok && res.data) {
        const data = res.data
        const msgs = Array.isArray(data) ? data : data?.messages || []
        setMessages(msgs)
        setHasMore(Array.isArray(data) ? msgs.length >= 30 : !!data?.has_more)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [token, convId])

  // Load more messages (pagination)
  const handleLoadMore = useCallback(async () => {
    if (!token || !convId || messages.length === 0 || !hasMore) return
    const oldest = messages[0]
    if (!oldest) return
    const res = await api.listMessages(token, convId, oldest.id)
    if (res.ok && res.data) {
      const data = res.data
      const older = Array.isArray(data) ? data : data?.messages || []
      if (older.length === 0) {
        setHasMore(false)
      } else {
        setMessages((prev) => [...older, ...prev])
        setHasMore(Array.isArray(data) ? older.length >= 30 : !!data?.has_more)
      }
    }
  }, [token, convId, messages, hasMore])

  // Send message - backend expects { conversation_id, layers: { summary }, mentions, reply_to }
  const handleSend = useCallback(async (text: string, attachments?: any[], mentions?: number[]) => {
    if (!token || !convId) return
    const msg: Parameters<typeof api.sendMessage>[1] = {
      conversation_id: convId,
      layers: { summary: text },
      mentions: mentions || [],
      reply_to: undefined,
    }
    if (attachments && attachments.length > 0) {
      msg.attachments = attachments
    }
    const res = await api.sendMessage(token, msg)
    if (res.ok && res.data) {
      setMessages((prev) => [...prev, res.data!])
    } else {
      // Fallback: reload messages
      const reload = await api.listMessages(token, convId)
      if (reload.ok && reload.data) {
        const data = reload.data
        const msgs = Array.isArray(data) ? data : data?.messages || []
        setMessages(msgs)
      }
    }
  }, [token, convId])

  // Revoke message
  const handleRevoke = useCallback(async (msgId: number) => {
    if (!token) return
    const res = await api.revokeMessage(token, msgId)
    if (res.ok) {
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, revoked_at: new Date().toISOString() } : m),
      )
    }
  }, [token])

  // React to message
  const handleReact = useCallback(async (msgId: number, emoji: string) => {
    if (!token) return
    const res = await api.toggleReaction(token, msgId, emoji)
    if (res.ok && res.data) {
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, reactions: res.data!.reactions } : m),
      )
    }
  }, [token])

  // Mark as read
  const handleMarkAsRead = useCallback(async (conversationId: number, messageId: number) => {
    if (!token) return
    api.markAsRead(token, conversationId, messageId).catch(() => {})
  }, [token])

  // File upload handler
  const handleFileUpload = useCallback(async (file: { uri: string; name: string; type: string; size: number }): Promise<string | null> => {
    if (!token) return null
    const res = await api.uploadFile(token, file.uri, file.name, file.type)
    if (res.ok && res.data?.url) return res.data.url
    return null
  }, [token])

  // Conversation settings handlers
  const handleConvUpdated = useCallback((partial: Partial<Conversation>) => {
    if (conversation) {
      const updated = { ...conversation, ...partial }
      setConversation(updated)
      updateConversation(convId, partial)
    }
  }, [conversation, convId, updateConversation])

  const handleConvLeave = useCallback(() => {
    removeConversation(convId)
    router.back()
  }, [convId, removeConversation, router])

  // Build a fallback conversation for ChatThread if null
  const displayConv = conversation || {
    id: convId,
    conv_type: 'direct' as const,
    title: `Chat #${id}`,
    description: '',
    prompt: '',
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    participants: [],
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ChatThread
          conversation={displayConv}
          messages={messages}
          streams={[]}
          myEntityId={entity?.id || 0}
          myEntity={entity || { id: 0, entity_type: 'user', name: 'me', display_name: 'Me', status: 'active', metadata: {}, created_at: '', updated_at: '' }}
          loading={loading}
          hasMore={hasMore}
          onBack={() => router.back()}
          onSettings={() => setShowSettings(true)}
          onLoadMore={handleLoadMore}
          onSend={handleSend}
          onRevoke={handleRevoke}
          onReact={handleReact}
          onMarkAsRead={handleMarkAsRead}
          onFileUpload={handleFileUpload}
        />
      </SafeAreaView>

      {/* Conversation Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <ConversationSettings
            conversation={displayConv}
            onClose={() => setShowSettings(false)}
            onLeave={handleConvLeave}
            onUpdated={handleConvUpdated}
          />
        </SafeAreaView>
      </Modal>

      {/* Task Panel Modal */}
      <Modal
        visible={showTasks}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTasks(false)}
      >
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <TaskPanel
            conversationId={convId}
            participants={displayConv.participants || []}
            onClose={() => setShowTasks(false)}
          />
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
})
