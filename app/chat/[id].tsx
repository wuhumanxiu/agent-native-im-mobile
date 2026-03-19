import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Modal, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../src/store/auth'
import { useConversationsStore } from '../../src/store/conversations'
import { useMessagesStore } from '../../src/store/messages'
import * as api from '../../src/lib/api'
import type { Message, Conversation, ActiveStream, Entity } from '../../src/lib/types'
import { ChatThread } from '../../src/components/chat/ChatThread'
import { ConversationSettings } from '../../src/components/conversation/ConversationSettings'
import { TaskPanel } from '../../src/components/task/TaskPanel'
import { useWSContext } from '../../src/hooks/WebSocketContext'
import { usePresenceStore } from '../../src/store/presence'

export default function ChatDetailScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const convId = Number(id)
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const updateConversation = useConversationsStore((s) => s.updateConversation)
  const removeConversation = useConversationsStore((s) => s.removeConversation)
  const readReceipts = useConversationsStore((s) => s.readReceipts)
  const wsConnected = usePresenceStore((s) => s.wsConnected)

  // WebSocket context — typing, streams, cancel
  const { typingMap, sendTyping, sendCancelStream } = useWSContext()

  const [conversation, setConversation] = useState<Conversation | null>(
    conversations.find((c) => c.id === convId) || null,
  )
  // Messages directly from store — WS addMessage writes here, no local state needed
  const EMPTY: Message[] = useMemo(() => [], [])
  const messages = useMessagesStore((s) => s.byConv[convId]) || EMPTY
  const storeStreams = useMessagesStore((s) => s.streams)
  const progress = useMessagesStore((s) => s.progress[convId])
  const setStoreMessages = useMessagesStore((s) => s.setMessages)
  const prependStoreMessages = useMessagesStore((s) => s.prependMessages)
  const addStoreMessage = useMessagesStore((s) => s.addMessage)
  const addOptimisticMessage = useMessagesStore((s) => s.addOptimisticMessage)
  const replaceOptimisticMessage = useMessagesStore((s) => s.replaceOptimisticMessage)
  const setOptimisticState = useMessagesStore((s) => s.setOptimisticState)
  const revokeStoreMessage = useMessagesStore((s) => s.revokeMessage)
  const updateReactions = useMessagesStore((s) => s.updateMessageReactions)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [botThinking, setBotThinking] = useState(false)
  const botThinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Set active conversation for unread count tracking
  const setActive = useConversationsStore((s) => s.setActive)
  useEffect(() => {
    setActive(convId)
    return () => setActive(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId])

  // Active streams for this conversation
  const convStreams = useMemo<ActiveStream[]>(() => {
    return Object.values(storeStreams).filter((s) => s.conversation_id === convId)
  }, [storeStreams, convId])

  const isGroup = conversation?.conv_type === 'group' || conversation?.conv_type === 'channel'
  const botParticipant = useMemo(() => {
    const participants = conversation?.participants || []
    return participants.find((participant) => {
      const participantEntity = participant.entity
      return participant.entity_id !== entity?.id && (
        participantEntity?.entity_type === 'bot' || participantEntity?.entity_type === 'service'
      )
    })?.entity
  }, [conversation?.participants, entity?.id])
  const isDmWithBot = !isGroup && !!botParticipant

  const stopBotThinking = useCallback(() => {
    if (botThinkingTimerRef.current) {
      clearTimeout(botThinkingTimerRef.current)
      botThinkingTimerRef.current = null
    }
    setBotThinking(false)
  }, [])

  const startBotThinking = useCallback(() => {
    if (botThinkingTimerRef.current) clearTimeout(botThinkingTimerRef.current)
    setBotThinking(true)
    botThinkingTimerRef.current = setTimeout(() => {
      setBotThinking(false)
      botThinkingTimerRef.current = null
    }, 60000)
  }, [])

  // Typing/processing info for this conversation
  const typingInfo = useMemo<{ text: string; isProcessing: boolean } | null>(() => {
    const convTyping = typingMap.get(convId)
    if (!convTyping || convTyping.size === 0) return null
    const now = Date.now()
    const activeNames: string[] = []
    let processingEntry: { name: string; phase?: string } | null = null
    convTyping.forEach((entry, eid) => {
      if (entry.expiresAt > now && eid !== entity?.id) {
        if (entry.isProcessing) {
          processingEntry = { name: entry.name, phase: entry.phase }
        } else {
          activeNames.push(entry.name)
        }
      }
    })
    if (processingEntry) {
      const phaseKey = processingEntry.phase
      const phaseText = phaseKey
        ? t(`chat.${phaseKey}`, { defaultValue: t('chat.processing') })
        : t('chat.processing')
      return { text: `${processingEntry.name} ${phaseText}`, isProcessing: true }
    }
    if (activeNames.length === 0) return null
    if (activeNames.length === 1) {
      return { text: t('message.isTyping', { name: activeNames[0] }), isProcessing: false }
    }
    return { text: t('message.areTyping', { names: activeNames.join(', ') }), isProcessing: false }
  }, [typingMap, convId, entity?.id, t])

  useEffect(() => {
    if (!botThinking) return

    const lastMessage = messages[messages.length - 1]
    if (
      lastMessage &&
      lastMessage.sender_id !== entity?.id &&
      (lastMessage.sender_type === 'bot' || lastMessage.sender_type === 'service')
    ) {
      queueMicrotask(stopBotThinking)
      return
    }

    if (typingInfo || progress || convStreams.length > 0) {
      queueMicrotask(stopBotThinking)
      return
    }

    return () => stopBotThinking()
  }, [botThinking, messages, entity?.id, typingInfo, progress, convStreams.length, stopBotThinking])

  // Read receipts for this conversation: entityId -> last read messageId
  const convReadReceipts = useMemo<Record<number, number>>(() => {
    const receipts = readReceipts[convId]
    if (!receipts) return {}
    const map: Record<number, number> = {}
    for (const [eid, receipt] of Object.entries(receipts)) {
      map[Number(eid)] = receipt.messageId
    }
    return map
  }, [readReceipts, convId])

  // Typing sender callback
  const handleTyping = useCallback(() => {
    sendTyping(convId)
  }, [sendTyping, convId])

  // Cancel stream callback
  const handleCancelStream = useCallback((streamId: string, conversationId: number) => {
    sendCancelStream(streamId, conversationId)
  }, [sendCancelStream])

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
        const raw = Array.isArray(data) ? data : data?.messages || []
        // API returns newest-first, UI needs oldest-first (FlatList inverted flips it)
        const msgs = [...raw].reverse()
        setStoreMessages(convId, msgs, raw.length >= 30)
        setHasMore(Array.isArray(data) ? raw.length >= 30 : !!data?.has_more)
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
      const raw = Array.isArray(data) ? data : data?.messages || []
      const older = [...raw].reverse() // API returns newest-first
      if (older.length === 0) {
        setHasMore(false)
      } else {
        prependStoreMessages(convId, older, raw.length >= 30)
        setHasMore(Array.isArray(data) ? raw.length >= 30 : !!data?.has_more)
      }
    }
  }, [token, convId, messages, hasMore])

  // Send message - backend expects { conversation_id, layers: { summary }, mentions, reply_to }
  const handleSend = useCallback(async (text: string, attachments?: any[], mentions?: number[], replyToId?: number) => {
    if (!token || !convId) return
    const msg: Parameters<typeof api.sendMessage>[1] = {
      conversation_id: convId,
      layers: { summary: text },
      mentions: mentions || [],
      reply_to: replyToId,
    }
    if (attachments && attachments.length > 0) {
      msg.attachments = attachments
    }
    const res = await api.sendMessage(token, msg)
    if (res.ok && res.data) {
      addStoreMessage(res.data)
      if (isDmWithBot) {
        startBotThinking()
      } else if (isGroup && mentions && botParticipant && mentions.includes(botParticipant.id)) {
        startBotThinking()
      }
    }
  }, [token, convId, addStoreMessage, isDmWithBot, isGroup, botParticipant, startBotThinking])

  // Revoke message
  const handleRevoke = useCallback(async (msgId: number) => {
    if (!token) return
    const res = await api.revokeMessage(token, msgId)
    if (res.ok) {
      revokeStoreMessage(convId, msgId)
    }
  }, [token, convId, revokeStoreMessage])

  // React to message
  const handleReact = useCallback(async (msgId: number, emoji: string) => {
    if (!token) return
    const res = await api.toggleReaction(token, msgId, emoji)
    if (res.ok && res.data) {
      updateReactions(convId, msgId, res.data.reactions)
    }
  }, [token])

  const handleRespondInteraction = useCallback(async (msgId: number, value: string, label: string) => {
    if (!token) return
    const tempId = `interaction-${convId}-${msgId}-${Date.now()}`
    const optimisticId = -Date.now()
    addOptimisticMessage(tempId, {
      id: optimisticId,
      conversation_id: convId,
      sender_id: entity?.id || 0,
      sender: entity || undefined,
      content_type: 'text',
      layers: {
        summary: label,
        data: { interaction_reply: { reply_to: msgId, choice: value } },
      },
      reply_to: msgId,
      created_at: new Date().toISOString(),
    })

    const res = await api.sendMessage(token, {
      conversation_id: convId,
      content_type: 'text',
      layers: {
        summary: label,
        data: { interaction_reply: { reply_to: msgId, choice: value } },
      },
      reply_to: msgId,
    })
    if (res.ok && res.data) {
      replaceOptimisticMessage(tempId, res.data)
      if (isDmWithBot) {
        startBotThinking()
      } else if (isGroup && botParticipant) {
        startBotThinking()
      }
      return
    }
    setOptimisticState(tempId, 'failed')
  }, [token, convId, entity, addOptimisticMessage, replaceOptimisticMessage, setOptimisticState, isDmWithBot, isGroup, botParticipant, startBotThinking])

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

  useEffect(() => {
    return () => {
      if (botThinkingTimerRef.current) clearTimeout(botThinkingTimerRef.current)
    }
  }, [])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ChatThread
          conversation={displayConv}
          messages={messages}
          streams={convStreams}
          myEntityId={entity?.id || 0}
          myEntity={entity || { id: 0, entity_type: 'user', name: 'me', display_name: 'Me', status: 'active', metadata: {}, created_at: '', updated_at: '' }}
          loading={loading}
          hasMore={hasMore}
          wsConnected={wsConnected}
          typingInfo={typingInfo}
          progress={progress}
          thinkingEntity={botThinking ? botParticipant : undefined}
          readReceipts={convReadReceipts}
          onBack={() => router.back()}
          onSettings={() => setShowSettings(true)}
          onLoadMore={handleLoadMore}
          onSend={handleSend}
          onRevoke={handleRevoke}
          onReact={handleReact}
          onRespondInteraction={handleRespondInteraction}
          onMarkAsRead={handleMarkAsRead}
          onFileUpload={handleFileUpload}
          onTyping={handleTyping}
          onCancelStream={handleCancelStream}
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
