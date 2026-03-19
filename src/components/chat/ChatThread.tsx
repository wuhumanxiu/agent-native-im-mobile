import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Users, Settings, Search } from 'lucide-react-native'
import { MessageBubble } from './MessageBubble'
import { StreamingBubble } from './StreamingBubble'
import { ThinkingBubble, ProcessingDots } from './ThinkingBubble'
import { MessageComposer, type UploadedAttachment } from './MessageComposer'
import { SkeletonLoader } from '../ui/SkeletonLoader'
import { EntityAvatar } from '../ui/EntityAvatar'
import { ConnectionStatusBar } from '../ui/ConnectionStatusBar'
import { useThemeColors } from '../../lib/theme'
import { storage } from '../../lib/storage'
import type { Conversation, Message, ActiveStream, Entity, Participant } from '../../lib/types'
import type { ProgressEntry } from '../../store/messages'

// ─── Utility ─────────────────────────────────────────────────────

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name
}

function isBotOrService(entity?: { entity_type?: string } | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  conversation: Conversation
  messages: Message[]
  streams?: ActiveStream[]
  myEntityId: number
  myEntity: Entity
  loading?: boolean
  hasMore?: boolean
  isOnline?: boolean
  wsConnected?: boolean
  typingInfo?: { text: string; isProcessing: boolean } | null
  progress?: ProgressEntry
  thinkingEntity?: Entity
  readReceipts?: Record<number, number>
  isArchived?: boolean
  onBack?: () => void
  onSettings?: () => void
  onLoadMore?: () => void
  onEntityPress?: (entity: Entity) => void
  onSend: (text: string, attachments?: UploadedAttachment[], mentions?: number[], replyToId?: number) => void
  onAudioSend?: (blob: any, duration: number) => void
  onFileUpload?: (file: { uri: string; name: string; type: string; size: number }) => Promise<string | null>
  onTyping?: () => void
  onRevoke?: (msgId: number) => void
  onReply?: (msg: Message) => void
  onReact?: (msgId: number, emoji: string) => void
  onRespondInteraction?: (msgId: number, value: string, label: string) => void
  onRetryOutbox?: (tempId: string) => void
  onCancelStream?: (streamId: string, conversationId: number) => void
  onMarkAsRead?: (conversationId: number, messageId: number) => void
}

// ─── Component ───────────────────────────────────────────────────

export function ChatThread({
  conversation,
  messages,
  streams,
  myEntityId,
  myEntity,
  loading = false,
  hasMore = true,
  isOnline = false,
  wsConnected = true,
  typingInfo,
  progress,
  thinkingEntity,
  readReceipts,
  isArchived,
  onBack,
  onSettings,
  onLoadMore,
  onEntityPress,
  onSend,
  onAudioSend,
  onFileUpload,
  onTyping,
  onRevoke,
  onReply: onReplyProp,
  onReact,
  onRespondInteraction,
  onRetryOutbox,
  onCancelStream,
  onMarkAsRead,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const flatListRef = useRef<FlatList>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  const isGroup = conversation?.conv_type === 'group' || conversation?.conv_type === 'channel'
  const otherParticipant = (conversation?.participants || []).find((p) => p.entity_id !== myEntityId)?.entity
  const myParticipant = (conversation?.participants || []).find((p) => p.entity_id === myEntityId)
  const isObserver = myParticipant?.role === 'observer'
  const participantMap = useMemo(() => {
    const map = new Map<number, Entity>()
    for (const participant of conversation.participants || []) {
      if (participant.entity) map.set(participant.entity_id, participant.entity)
    }
    return map
  }, [conversation.participants])
  const outboxCount = useMemo(
    () => messages.filter((msg) => msg.temp_id && (msg.client_state === 'queued' || msg.client_state === 'failed')).length,
    [messages],
  )
  const outboxFailedCount = useMemo(
    () => messages.filter((msg) => msg.temp_id && msg.client_state === 'failed').length,
    [messages],
  )

  // Active streams for this conversation
  const convStreams = useMemo<ActiveStream[]>(
    () => (streams || []).filter((s) => s.conversation_id === conversation.id),
    [streams, conversation.id],
  )

  // Message map for reply lookups
  const messageMap = useMemo(() => {
    const map = new Map<number, Message>()
    messages.forEach((m) => map.set(m.id, m))
    return map
  }, [messages])

  // Check if a message has been read (for read receipt)
  const isMessageRead = useCallback((msgId: number): boolean => {
    if (!readReceipts) return false
    return Object.values(readReceipts).some((lastRead) => lastRead >= msgId)
  }, [readReceipts])

  // Mark as read on new messages
  useEffect(() => {
    if (messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    const timer = setTimeout(() => {
      onMarkAsRead?.(conversation.id, lastMsg.id)
    }, 300)
    return () => clearTimeout(timer)
  }, [messages, conversation.id, onMarkAsRead])

  // Restore reply target from draft when possible; otherwise clear on conversation switch.
  useEffect(() => {
    const draftKey = `aim_draft_${conversation.id}`
    const raw = storage.getString(draftKey)
    if (!raw) {
      setReplyTo(null)
      return
    }

    try {
      const parsed = JSON.parse(raw) as { replyTo?: { id: number } }
      const draftReplyId = parsed.replyTo?.id
      if (!draftReplyId) {
        setReplyTo(null)
        return
      }
      setReplyTo(messageMap.get(draftReplyId) || null)
    } catch {
      setReplyTo(null)
    }
  }, [conversation.id, messageMap])

  // Handle reply
  const handleReply = useCallback((msg: Message) => {
    if (isArchived) return
    setReplyTo(msg)
    onReplyProp?.(msg)
  }, [isArchived, onReplyProp])

  // Handle send (wraps to clear reply)
  const handleSend = useCallback((text: string, attachments?: UploadedAttachment[], mentions?: number[]) => {
    const currentReplyToId = replyTo?.id
    onSend(text, attachments, mentions, currentReplyToId)
    setReplyTo(null)
  }, [onSend, replyTo])

  // Load more messages
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore && onLoadMore) {
      onLoadMore()
    }
  }, [loading, hasMore, onLoadMore])

  // Determine if we should show sender (group messages from different sender)
  const shouldShowSender = useCallback((index: number, msg: Message, allMessages: Message[]): boolean => {
    if (index === 0) return true
    // In inverted list, previous message is at index + 1 since data is reversed
    const prevMsg = allMessages[index - 1]
    if (!prevMsg) return true
    if (prevMsg.sender_id !== msg.sender_id) return true
    // Show sender if more than 5 minutes gap
    const gap = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
    return Math.abs(gap) > 5 * 60 * 1000
  }, [])

  // Inverted data (newest first for FlatList inverted)
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages])

  // Date separator helper
  const formatDateSeparator = useCallback((dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return t('app.today') || 'Today'
    if (days === 1) return t('app.yesterday') || 'Yesterday'
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }, [t])

  // Render message item
  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isSelf = item.sender_id === myEntityId
    const showSender = isGroup ? shouldShowSender(index, item, invertedMessages) : (index === invertedMessages.length - 1 || invertedMessages[index + 1]?.sender_id !== item.sender_id)
    const replyMessage = item.reply_to ? messageMap.get(item.reply_to) : undefined

    // Date separator: show when day changes from next message (inverted list, so next = older)
    const nextMsg = invertedMessages[index + 1]
    const itemDate = new Date(item.created_at).toDateString()
    const nextDate = nextMsg ? new Date(nextMsg.created_at).toDateString() : null
    const showDateSeparator = !nextDate || itemDate !== nextDate

    return (
      <View style={itemStyles.container}>
        {showDateSeparator && (
          <View style={itemStyles.dateSeparator}>
            <View style={[itemStyles.dateLine, { backgroundColor: colors.border }]} />
            <Text style={[itemStyles.dateText, { color: colors.textMuted, backgroundColor: colors.bg }]}>
              {formatDateSeparator(item.created_at)}
            </Text>
            <View style={[itemStyles.dateLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <MessageBubble
          message={item}
          isSelf={isSelf}
          myEntityId={myEntityId}
          participantsMap={participantMap}
          replyMessage={replyMessage}
          onEntityPress={onEntityPress}
          showSender={showSender}
          isRead={isSelf ? isMessageRead(item.id) : undefined}
          onRevoke={isArchived ? undefined : onRevoke}
          onReply={isArchived ? undefined : handleReply}
          onReact={isArchived ? undefined : onReact}
          onRespondInteraction={isArchived ? undefined : onRespondInteraction}
          onRetryOutbox={isArchived ? undefined : onRetryOutbox}
        />
      </View>
    )
  }, [myEntityId, isGroup, shouldShowSender, invertedMessages, messageMap, participantMap, isMessageRead, isArchived, onEntityPress, onRevoke, handleReply, onReact, onRespondInteraction, onRetryOutbox, colors, formatDateSeparator])

  // Render streaming bubbles at the top (bottom visually in inverted list)
  const renderHeader = useCallback(() => {
    const hasStreams = convStreams.length > 0
    if (!hasStreams && !typingInfo && !progress && !thinkingEntity) return null
    return (
      <View style={itemStyles.headerContainer}>
        {progress && !hasStreams && (
          <View style={itemStyles.processingRow}>
            <ProcessingDots color={colors.accent} />
            <Text style={itemStyles.processingText}>
              {progress.status?.text || t('chat.processing')}
            </Text>
          </View>
        )}

        {thinkingEntity && !hasStreams && !progress && (
          <ThinkingBubble entity={thinkingEntity} />
        )}

        {typingInfo && (
          <View style={itemStyles.typingRow}>
            {typingInfo.isProcessing ? (
              <ProcessingDots color={colors.accent} />
            ) : null}
            <Text
              style={[
                itemStyles.typingText,
                typingInfo.isProcessing && itemStyles.processingTypingText,
              ]}
            >
              {typingInfo.text}
            </Text>
          </View>
        )}
        {convStreams.map((stream) => {
          const sender = conversation.participants?.find((p) => p.entity_id === stream.sender_id)?.entity
          return (
            <StreamingBubble
              key={stream.stream_id}
              stream={stream}
              sender={sender}
              onCancel={onCancelStream}
            />
          )
        })}
      </View>
    )
  }, [convStreams, typingInfo, progress, thinkingEntity, conversation.participants, onCancelStream, colors.accent, t])

  // Render loading more indicator
  const renderFooter = useCallback(() => {
    if (!loading || messages.length === 0) return null
    return (
      <View style={itemStyles.loadingMore}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    )
  }, [loading, messages.length, colors.accent])

  const keyExtractor = useCallback((item: Message) => String(item.id) + (item.temp_id || ''), [])

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bgSecondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        {onBack && (
          <Pressable
            style={({ pressed }) => [styles.headerButton, styles.headerBackButton, pressed && { backgroundColor: colors.bgHover }]}
            onPress={onBack}
            hitSlop={12}
          >
            <ArrowLeft size={20} color={colors.textSecondary} />
          </Pressable>
        )}

        {/* Title area */}
        <Pressable style={styles.titleArea} onPress={onSettings}>
          {isGroup ? (
            <View style={[styles.groupIconContainer, { backgroundColor: colors.accentDim }]}>
              <Users size={16} color={colors.accent} />
            </View>
          ) : (
            <EntityAvatar entity={otherParticipant} size="sm" showStatus isOnline={isOnline} />
          )}

          <View style={styles.titleContent}>
            <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
              {conversation.title || entityDisplayName(otherParticipant)}
            </Text>
            <Text style={[styles.subtitleText, { color: colors.textMuted }]}>
              {isGroup
                ? t('conversation.participants', { count: conversation.participants?.length || 0 })
                : isOnline
                  ? t('common.online')
                  : t('common.offline')
              }
            </Text>
          </View>
        </Pressable>

        {onSettings && (
          <Pressable
            style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.bgHover }]}
            onPress={onSettings}
          >
            <Settings size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ConnectionStatusBar
        connected={wsConnected}
        outboxCount={outboxCount}
        outboxFailedCount={outboxFailedCount}
      />

      {/* Messages */}
      {loading && messages.length === 0 ? (
        <SkeletonLoader variant="chat-messages" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={invertedMessages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={styles.messageList}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={15}
          windowSize={11}
          initialNumToRender={20}
        />
      )}

      {/* Composer */}
      <MessageComposer
        conversationId={conversation.id}
        onSend={handleSend}
        onAudioSend={onAudioSend}
        onFileUpload={onFileUpload}
        onTyping={onTyping}
        placeholder={t('conversation.typeMessage')}
        participants={conversation.participants}
        isObserver={isObserver || isArchived}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </KeyboardAvoidingView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  titleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  groupIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleContent: {
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  subtitleText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  messageList: {
    paddingVertical: 8,
    gap: 4,
  },
})

const itemStyles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  headerContainer: {
    gap: 8,
    paddingBottom: 4,
  },
  typingRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  processingTypingText: {
    color: '#a78bfa',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  processingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
})
