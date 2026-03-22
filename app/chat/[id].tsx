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
import { EntityQuickSheet } from '../../src/components/entity/EntityQuickSheet'
import { useWSContext } from '../../src/hooks/WebSocketContext'
import { usePresenceStore } from '../../src/store/presence'
import { normalizeAttachmentUrl } from '../../src/lib/files'
import { buildDirectConversationTitle } from '../../src/lib/conversation-title'
import { cacheMessages, getCachedMessages, deleteOutboxMessage, enqueueOutboxMessage, listOutboxMessagesByConversation, updateOutboxMessage } from '../../src/lib/cache'

export default function ChatDetailScreen() {
  const { t } = useTranslation()
  const { id, backTo } = useLocalSearchParams<{ id: string; backTo?: string }>()
  const convId = Number(id)
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const updateConversation = useConversationsStore((s) => s.updateConversation)
  const removeConversation = useConversationsStore((s) => s.removeConversation)
  const readReceipts = useConversationsStore((s) => s.readReceipts)
  const wsConnected = usePresenceStore((s) => s.wsConnected)
  const onlineSet = usePresenceStore((s) => s.online)
  const lastSyncAt = usePresenceStore((s) => s.lastSyncAt)

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
  const mergeStoreMessages = useMessagesStore((s) => s.mergeMessages)
  const replaceOptimisticMessage = useMessagesStore((s) => s.replaceOptimisticMessage)
  const setOptimisticState = useMessagesStore((s) => s.setOptimisticState)
  const revokeStoreMessage = useMessagesStore((s) => s.revokeMessage)
  const updateReactions = useMessagesStore((s) => s.updateMessageReactions)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [botThinkingEntity, setBotThinkingEntity] = useState<Entity | null>(null)
  const [directParticipantOnline, setDirectParticipantOnline] = useState(false)
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
  const otherParticipant = useMemo(() => (
    (conversation?.participants || []).find((participant) => participant.entity_id !== entity?.id)?.entity || null
  ), [conversation?.participants, entity?.id])
  const botParticipants = useMemo(() => {
    return (conversation?.participants || [])
      .filter((participant) => participant.entity_id !== entity?.id)
      .map((participant) => participant.entity)
      .filter((participantEntity): participantEntity is Entity => (
        !!participantEntity && (
          participantEntity.entity_type === 'bot' || participantEntity.entity_type === 'service'
        )
      ))
  }, [conversation?.participants, entity?.id])
  const directBotParticipant = !isGroup ? (botParticipants[0] || null) : null
  const isDirectOtherOnline = otherParticipant ? directParticipantOnline : false

  const stopBotThinking = useCallback(() => {
    if (botThinkingTimerRef.current) {
      clearTimeout(botThinkingTimerRef.current)
      botThinkingTimerRef.current = null
    }
    setBotThinkingEntity(null)
  }, [])

  const startBotThinking = useCallback((target?: Entity | null) => {
    if (!target) return
    if (botThinkingTimerRef.current) clearTimeout(botThinkingTimerRef.current)
    setBotThinkingEntity(target)
    botThinkingTimerRef.current = setTimeout(() => {
      setBotThinkingEntity(null)
      botThinkingTimerRef.current = null
    }, 60000)
  }, [])

  const resolveProcessingEntity = useCallback((mentions?: number[]) => {
    if (!isGroup) return directBotParticipant
    if (!mentions || mentions.length === 0) return null
    const mentionedBots = botParticipants.filter((participant) => mentions.includes(participant.id))
    return mentionedBots.length === 1 ? mentionedBots[0] : null
  }, [isGroup, directBotParticipant, botParticipants])

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
    if (!botThinkingEntity) return

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
  }, [botThinkingEntity, messages, entity?.id, typingInfo, progress, convStreams.length, stopBotThinking])

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

  const hydrateCachedMessages = useCallback(() => {
    const cached = getCachedMessages(convId)
    if (cached.length > 0) {
      setStoreMessages(convId, cached, true)
    }
    const queued = listOutboxMessagesByConversation(convId).map((item) => ({
      id: -(Math.abs(Number(item.created_at.replace(/\D/g, '').slice(-10))) || Date.now()),
      temp_id: item.temp_id,
      conversation_id: item.conversation_id,
      sender_id: entity?.id || 0,
      sender: entity || undefined,
      content_type: (item.content_type as Message['content_type']) || 'text',
      layers: { summary: item.text },
      mentions: item.mentions,
      reply_to: item.reply_to,
      created_at: item.created_at,
      client_state: item.sync_state === 'failed' ? 'failed' : 'queued',
    } as Message))
    if (queued.length > 0) {
      mergeStoreMessages(convId, queued)
    }
  }, [convId, entity, mergeStoreMessages, setStoreMessages])

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
    hydrateCachedMessages()
    setLoading(true)
    api.listMessages(token, convId).then((res) => {
      if (res.ok && res.data) {
        const data = res.data
        const raw = Array.isArray(data) ? data : data?.messages || []
        // API returns newest-first, UI needs oldest-first (FlatList inverted flips it)
        const msgs = [...raw].reverse()
        setStoreMessages(convId, msgs, raw.length >= 30)
        cacheMessages(convId, msgs)
        setHasMore(Array.isArray(data) ? raw.length >= 30 : !!data?.has_more)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [token, convId, hydrateCachedMessages, setStoreMessages])

  useEffect(() => {
    if (!otherParticipant) {
      setDirectParticipantOnline(false)
      return
    }

    setDirectParticipantOnline(onlineSet.has(otherParticipant.id))

    if (!token) return
    let cancelled = false
    api.getEntityStatus(token, otherParticipant.id).then((res) => {
      if (cancelled || !res.ok || !res.data) return
      setDirectParticipantOnline(!!res.data.online)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [otherParticipant, onlineSet, token])

  useEffect(() => {
    if (messages.length > 0) {
      cacheMessages(convId, messages)
    }
  }, [convId, messages])

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
        cacheMessages(convId, [...older, ...messages])
        setHasMore(Array.isArray(data) ? raw.length >= 30 : !!data?.has_more)
      }
    }
  }, [token, convId, messages, hasMore])

  // Send message - backend expects { conversation_id, layers: { summary }, mentions, reply_to }
  const handleSend = useCallback(async (text: string, attachments?: any[], mentions?: number[], replyToId?: number) => {
    if (!token || !convId) return
    const trimmed = text.trim()
    const tempId = `msg-${convId}-${Date.now()}`
    const createdAt = new Date().toISOString()
    const msg: Parameters<typeof api.sendMessage>[1] = {
      conversation_id: convId,
      layers: { summary: trimmed },
      mentions: mentions || [],
      reply_to: replyToId,
    }
    if (attachments && attachments.length > 0) {
      msg.attachments = attachments.map((attachment) => ({
        ...attachment,
        url: normalizeAttachmentUrl(attachment?.url),
      }))
    }
    const canQueueOffline = (!attachments || attachments.length === 0)
    const optimisticId = -Date.now()
    addOptimisticMessage(tempId, {
      id: optimisticId,
      temp_id: tempId,
      conversation_id: convId,
      sender_id: entity?.id || 0,
      sender: entity || undefined,
      content_type: attachments && attachments.length > 0 ? 'file' : 'text',
      layers: { summary: trimmed },
      attachments,
      mentions: mentions || [],
      reply_to: replyToId,
      created_at: createdAt,
      client_state: wsConnected ? 'sending' : 'queued',
    })

    if (!wsConnected && canQueueOffline) {
      enqueueOutboxMessage({
        id: tempId,
        temp_id: tempId,
        conversation_id: convId,
        content_type: 'text',
        text: trimmed,
        mentions: mentions || [],
        reply_to: replyToId,
        created_at: createdAt,
        sync_state: 'queued',
      })
      cacheMessages(convId, useMessagesStore.getState().byConv[convId] || [])
      return
    }

    try {
      const res = await api.sendMessage(token, msg)
      if (res.ok && res.data) {
        replaceOptimisticMessage(tempId, res.data)
        cacheMessages(convId, useMessagesStore.getState().byConv[convId] || [])
        startBotThinking(resolveProcessingEntity(mentions))
        return
      }
      if (canQueueOffline) {
        setOptimisticState(tempId, 'queued')
        enqueueOutboxMessage({
          id: tempId,
          temp_id: tempId,
          conversation_id: convId,
          content_type: 'text',
          text: trimmed,
          mentions: mentions || [],
          reply_to: replyToId,
          created_at: createdAt,
          sync_state: 'queued',
          last_error: typeof res.error === 'string' ? res.error : undefined,
        })
        cacheMessages(convId, useMessagesStore.getState().byConv[convId] || [])
        return
      }
      setOptimisticState(tempId, 'failed')
    } catch {
      if (canQueueOffline) {
        setOptimisticState(tempId, 'queued')
        enqueueOutboxMessage({
          id: tempId,
          temp_id: tempId,
          conversation_id: convId,
          content_type: 'text',
          text: trimmed,
          mentions: mentions || [],
          reply_to: replyToId,
          created_at: createdAt,
          sync_state: 'queued',
        })
        cacheMessages(convId, useMessagesStore.getState().byConv[convId] || [])
        return
      }
      setOptimisticState(tempId, 'failed')
    }
  }, [token, convId, entity, wsConnected, addOptimisticMessage, replaceOptimisticMessage, setOptimisticState, startBotThinking, resolveProcessingEntity])

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
    const sourceMessage = messages.find((message) => message.id === msgId)
    const processingEntity = sourceMessage?.sender && (
      sourceMessage.sender.entity_type === 'bot' || sourceMessage.sender.entity_type === 'service'
    )
      ? sourceMessage.sender
      : null
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
      startBotThinking(processingEntity)
      return
    }
    setOptimisticState(tempId, 'failed')
  }, [token, convId, entity, messages, addOptimisticMessage, replaceOptimisticMessage, setOptimisticState, startBotThinking])

  // Mark as read
  const handleMarkAsRead = useCallback(async (conversationId: number, messageId: number) => {
    if (!token) return
    updateConversation(conversationId, { unread_count: 0 })
    api.markAsRead(token, conversationId, messageId).catch(() => {})
  }, [token, updateConversation])

  const handleRetryOutbox = useCallback(async (tempId: string) => {
    if (!token) return
    const queued = listOutboxMessagesByConversation(convId).find((item) => item.temp_id === tempId)
    if (!queued) return
    setOptimisticState(tempId, 'sending')
    updateOutboxMessage(queued.id, {
      sync_state: 'sending',
      attempts: (queued.attempts || 0) + 1,
      last_attempt_at: new Date().toISOString(),
      last_error: '',
    })
    const res = await api.sendMessage(token, {
      conversation_id: queued.conversation_id,
      content_type: queued.content_type || 'text',
      layers: { summary: queued.text },
      mentions: queued.mentions,
      reply_to: queued.reply_to,
    })
    if (res.ok && res.data) {
      replaceOptimisticMessage(tempId, res.data)
      deleteOutboxMessage(queued.id)
      cacheMessages(convId, useMessagesStore.getState().byConv[convId] || [])
      return
    }
    setOptimisticState(tempId, 'failed')
    updateOutboxMessage(queued.id, {
      sync_state: 'failed',
      last_error: typeof res.error === 'string' ? res.error : 'sync_failed',
      last_attempt_at: new Date().toISOString(),
    })
  }, [token, convId, replaceOptimisticMessage, setOptimisticState])

  // File upload handler
  const handleFileUpload = useCallback(async (file: { uri: string; name: string; type: string; size: number }): Promise<string | null> => {
    if (!token) return null
    const res = await api.uploadFile(token, file.uri, file.name, file.type)
    if (res.ok && res.data?.url) return res.data.url
    return null
  }, [token])

  const handleEntityPress = useCallback((pressedEntity: Entity) => {
    if (pressedEntity.id === entity?.id) return
    setSelectedEntity(pressedEntity)
  }, [entity?.id])

  const handleStartChatWithEntity = useCallback(async (target: Entity) => {
    if (!token) return
    const title = buildDirectConversationTitle(t, target)
    const res = await api.createConversation(token, {
      title,
      conv_type: 'direct',
      participant_ids: [target.id],
    })
    if (res.ok && res.data) {
      setSelectedEntity(null)
      router.push(`/chat/${res.data.id}`)
    }
  }, [token, router, t])

  const handleOpenEntityDetails = useCallback((target: Entity) => {
    setSelectedEntity(null)
    router.push(`/bots/${target.id}`)
  }, [router])

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
          isOnline={isDirectOtherOnline}
          wsConnected={wsConnected}
          lastSyncAt={lastSyncAt}
          typingInfo={typingInfo}
          progress={progress}
          thinkingEntity={botThinkingEntity || undefined}
          readReceipts={convReadReceipts}
          onEntityPress={handleEntityPress}
          onBack={() => {
            if (backTo === 'list') {
              router.replace('/(tabs)/chat')
              return
            }
            if (typeof router.canGoBack === 'function' && router.canGoBack()) {
              router.back()
              return
            }
            router.replace('/(tabs)/chat')
          }}
          onSettings={() => setShowSettings(true)}
          onToggleTasks={() => setShowTasks(true)}
          onLoadMore={handleLoadMore}
          onSend={handleSend}
          onRevoke={handleRevoke}
          onReact={handleReact}
          onRespondInteraction={handleRespondInteraction}
          onRetryOutbox={handleRetryOutbox}
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

      <Modal
        visible={!!selectedEntity}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedEntity(null)}
      >
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {selectedEntity ? (
            <EntityQuickSheet
              entity={selectedEntity}
              isOnline={onlineSet.has(selectedEntity.id)}
              canViewDetails={
                (selectedEntity.entity_type === 'bot' || selectedEntity.entity_type === 'service') &&
                selectedEntity.owner_id === entity?.id
              }
              onClose={() => setSelectedEntity(null)}
              onStartChat={handleStartChatWithEntity}
              onViewDetails={handleOpenEntityDetails}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
})
