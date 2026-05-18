import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Platform, KeyboardAvoidingView, Alert, RefreshControl, useWindowDimensions, PixelRatio, Modal, TextInput, ScrollView, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import { ArrowLeft, Settings, Search, ListTodo, Bug, Check, Forward, CheckSquare, Send, X } from 'lucide-react-native'
import { MessageBubble } from './MessageBubble'
import { StreamingBubble } from './StreamingBubble'
import { ThinkingBubble, ProcessingDots } from './ThinkingBubble'
import { MessageComposer, type UploadedAttachment } from './MessageComposer'
import { SkeletonLoader } from '../ui/SkeletonLoader'
import { ActionSheet } from '../ui/ActionSheet'
import { EntityAvatar } from '../ui/EntityAvatar'
import { GroupAvatar } from '../conversation/GroupAvatar'
import { ConnectionStatusBar } from '../ui/ConnectionStatusBar'
import {
  buildDebugReport,
  buildLayoutDebugReport,
  buildNetworkDebugReport,
  clearDebugEvents,
  logDebugEvent,
  type DebugLayoutBox,
} from '../../lib/debug-telemetry'
import { useThemeColors } from '../../lib/theme'
import { storage } from '../../lib/storage'
import type { Conversation, Message, ActiveStream, Entity, Participant, PresenceStateValue } from '../../lib/types'
import type { ProgressEntry } from '../../store/messages'
import { useSettingsStore } from '../../store/settings'

// ─── Utility ─────────────────────────────────────────────────────

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name
}

function formatForwardPreviewTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function isBotOrService(entity?: { entity_type?: string } | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  conversation: Conversation
  conversations?: Conversation[]
  messages: Message[]
  streams?: ActiveStream[]
  myEntityId: number
  myEntity: Entity
  loading?: boolean
  refreshing?: boolean
  hasMore?: boolean
  presenceState?: PresenceStateValue
  wsConnected?: boolean
  lastSyncAt?: string | null
  typingInfo?: { text: string; isProcessing: boolean } | null
  progress?: ProgressEntry
  thinkingEntity?: Entity
  readReceipts?: Record<number, number>
  isArchived?: boolean
  onBack?: () => void
  onSettings?: () => void
  onToggleTasks?: () => void
  onLoadMore?: () => void
  onRefresh?: () => Promise<void> | void
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
  onForwardMessages?: (target: Conversation, bodies: string[], mentions: number[], forwarded: ForwardPayload[]) => Promise<void> | void
}
type ForwardMode = 'merged' | 'separate'

interface ForwardRecord {
  message_id: number
  sender_id: number
  sender_name: string
  sender_avatar_url?: string
  text: string
  created_at: string
  is_self: boolean
}

interface ForwardPayload {
  title: string
  source_conversation_id: number
  message_ids: number[]
  mode: ForwardMode
  records: ForwardRecord[]
  note?: string
}

// ─── Component ───────────────────────────────────────────────────

export function ChatThread({
  conversation,
  conversations = [],
  messages,
  streams,
  myEntityId,
  myEntity,
  loading = false,
  refreshing = false,
  hasMore = true,
  presenceState = 'unknown',
  wsConnected = true,
  lastSyncAt,
  typingInfo,
  progress,
  thinkingEntity,
  readReceipts,
  isArchived,
  onBack,
  onSettings,
  onToggleTasks,
  onLoadMore,
  onRefresh,
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
  onForwardMessages,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const window = useWindowDimensions()
  const devMode = useSettingsStore((s) => s.devMode)
  const flatListRef = useRef<FlatList>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [debugCopied, setDebugCopied] = useState(false)
  const [debugCopyError, setDebugCopyError] = useState(false)
  const [debugSheetVisible, setDebugSheetVisible] = useState(false)
  const [debugStatusKey, setDebugStatusKey] = useState<string | null>(null)
  const [layoutRegions, setLayoutRegions] = useState<Record<string, DebugLayoutBox>>({})
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set())
  const [forwardingMessages, setForwardingMessages] = useState<Message[] | null>(null)
  const [forwardMode, setForwardMode] = useState<ForwardMode>('merged')
  const [forwardNote, setForwardNote] = useState('')
  const [forwardTargetId, setForwardTargetId] = useState<number | null>(null)
  const [forwardSending, setForwardSending] = useState(false)

  const isGroup = conversation?.conv_type === 'group' || conversation?.conv_type === 'channel'
  const otherParticipant = (conversation?.participants || []).find((p) => p.entity_id !== myEntityId)?.entity
  const botParticipants = (conversation?.participants || [])
    .filter((p) => p.entity_id !== myEntityId)
    .map((p) => p.entity)
    .filter((entity): entity is Entity => !!entity && isBotOrService(entity))
  const directBotParticipant = !isGroup ? (botParticipants[0] || null) : null
  const composerTargetBot = !isGroup ? directBotParticipant : (botParticipants.length === 1 ? botParticipants[0] : null)
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

  const getMessageForwardText = useCallback((msg: Message) => {
    const body = (msg.layers?.data?.body as string) || msg.layers?.summary || ''
    if (body.trim()) return body.trim()
    if (msg.content_type === 'audio') return t('message.forwardAudio')
    if (msg.attachments?.length) {
      return msg.attachments.map((att) => att.filename || att.type || t('message.forwardAttachment')).join(', ')
    }
    return t('message.forwardUnsupported')
  }, [t])

  const buildForwardBodies = useCallback((items: Message[], mode: ForwardMode, note: string) => {
    const cleanNote = note.trim()
    if (mode === 'merged') {
      const merged = items.map((msg) => `${entityDisplayName(msg.sender)}: ${getMessageForwardText(msg)}`).join('\n\n')
      return [cleanNote ? `${merged}\n\n${cleanNote}` : merged]
    }
    const bodies = items.map(getMessageForwardText)
    return cleanNote ? [...bodies, cleanNote] : bodies
  }, [getMessageForwardText])

  const buildForwardRecords = useCallback((items: Message[]): ForwardRecord[] => items.map((msg) => ({
    message_id: msg.id,
    sender_id: msg.sender_id,
    sender_name: entityDisplayName(msg.sender),
    sender_avatar_url: msg.sender?.avatar_url,
    text: getMessageForwardText(msg),
    created_at: msg.created_at,
    is_self: msg.sender_id === myEntityId,
  })), [getMessageForwardText, myEntityId])

  const buildForwardPayloads = useCallback((items: Message[], mode: ForwardMode, note: string): ForwardPayload[] => {
    const records = buildForwardRecords(items)
    const base = {
      title: t('message.forwardChatRecord'),
      source_conversation_id: conversation.id,
      message_ids: items.map((msg) => msg.id),
      mode,
    }
    if (mode === 'merged') {
      return [{ ...base, records, note: note.trim() || undefined }]
    }
    return records.map((record) => ({ ...base, records: [record] }))
  }, [buildForwardRecords, conversation.id, t])

  const resolveForwardMentionIds = useCallback((target: Conversation | undefined, note: string) => {
    if (!target || !note.includes('@')) return []
    const ids = new Set<number>()
    for (const participant of target.participants || []) {
      const entity = participant.entity
      if (!entity) continue
      const names = [entity.display_name, entity.name, entity.bot_id].filter(Boolean) as string[]
      if (names.some((name) => note.includes(`@${name}`))) ids.add(participant.entity_id)
    }
    return [...ids]
  }, [])

  const startForward = useCallback((items: Message[]) => {
    if (items.length === 0) return
    setForwardingMessages(items)
    setForwardMode(items.length > 1 ? 'merged' : 'separate')
    setForwardNote('')
    setForwardTargetId(conversation.id)
  }, [conversation.id])

  const handleSelectMessage = useCallback((msg: Message) => {
    setSelectionMode(true)
    setSelectedMessageIds(new Set([msg.id]))
  }, [])

  const toggleSelectedMessage = useCallback((msg: Message) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(msg.id)) next.delete(msg.id)
      else next.add(msg.id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedMessageIds(new Set())
  }, [])

  const handleForwardSelected = useCallback(() => {
    startForward(messages.filter((msg) => selectedMessageIds.has(msg.id)))
  }, [messages, selectedMessageIds, startForward])

  const submitForward = useCallback(async () => {
    if (!forwardingMessages || !forwardTargetId || forwardSending || !onForwardMessages) return
    const target = conversations.find((item) => item.id === forwardTargetId)
    if (!target) return
    setForwardSending(true)
    try {
      await onForwardMessages(
        target,
        buildForwardBodies(forwardingMessages, forwardMode, forwardNote),
        resolveForwardMentionIds(target, forwardNote),
        buildForwardPayloads(forwardingMessages, forwardMode, forwardNote),
      )
      setForwardingMessages(null)
      setForwardNote('')
      clearSelection()
    } finally {
      setForwardSending(false)
    }
  }, [buildForwardBodies, buildForwardPayloads, clearSelection, conversations, forwardMode, forwardNote, forwardSending, forwardingMessages, forwardTargetId, onForwardMessages, resolveForwardMentionIds])

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
  const interactionResponseMap = useMemo(() => {
    const map = new Map<number, Message>()
    for (const msg of messages) {
      const reply = msg.layers?.data?.interaction_reply as { reply_to?: number } | undefined
      const replyToId = typeof reply?.reply_to === 'number' ? reply.reply_to : undefined
      if (replyToId) map.set(replyToId, msg)
    }
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
    const interactionResponse = interactionResponseMap.get(item.id)

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
          interactionResponse={interactionResponse}
          onEntityPress={onEntityPress}
          showSender={showSender}
          isRead={isSelf ? isMessageRead(item.id) : undefined}
          onRevoke={isArchived ? undefined : onRevoke}
          onReply={isArchived ? undefined : handleReply}
          onReact={isArchived ? undefined : onReact}
          onRespondInteraction={isArchived ? undefined : onRespondInteraction}
          onRetryOutbox={isArchived ? undefined : onRetryOutbox}
          onForward={isArchived || !onForwardMessages ? undefined : (msg) => startForward([msg])}
          onSelect={isArchived || !onForwardMessages ? undefined : handleSelectMessage}
          selectionMode={selectionMode}
          selected={selectedMessageIds.has(item.id)}
          onToggleSelected={toggleSelectedMessage}
        />
      </View>
    )
  }, [myEntityId, isGroup, shouldShowSender, invertedMessages, messageMap, interactionResponseMap, participantMap, isMessageRead, isArchived, onEntityPress, onRevoke, handleReply, onReact, onRespondInteraction, onRetryOutbox, onForwardMessages, startForward, handleSelectMessage, selectionMode, selectedMessageIds, toggleSelectedMessage, colors, formatDateSeparator])

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

  const handleOpenDebugSheet = useCallback(() => {
    setDebugSheetVisible(true)
    logDebugEvent('debug.sheet.open', {
      conversationId: conversation.id,
      messageCount: messages.length,
    })
  }, [conversation.id, messages.length])

  const debugContext = useMemo(() => ({
    conversationId: conversation.id,
    conversationType: conversation.conv_type,
    participantCount: conversation.participants?.length || 0,
    messageCount: messages.length,
    outboxCount,
    outboxFailedCount,
    wsConnected,
    peerPresence: presenceState,
    hasStreams: convStreams.length > 0,
  }), [conversation, convStreams.length, messages.length, outboxCount, outboxFailedCount, presenceState, wsConnected])

  const debugLayout = useMemo(() => ({
    screen: {
      width: Math.round(window.width),
      height: Math.round(window.height),
      scale: PixelRatio.get(),
      fontScale: PixelRatio.getFontScale(),
    },
    regions: layoutRegions,
  }), [layoutRegions, window.height, window.width])

  const recordLayout = useCallback((region: string) => (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout
    const next = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    }
    setLayoutRegions((prev) => {
      const current = prev[region]
      if (
        current
        && current.x === next.x
        && current.y === next.y
        && current.width === next.width
        && current.height === next.height
      ) {
        return prev
      }
      return { ...prev, [region]: next }
    })
  }, [])

  const copyDebugReport = useCallback(async (
    kind: 'full' | 'network' | 'layout',
    report: string,
    successKey: string,
  ) => {
    setDebugCopied(true)
    setDebugCopyError(false)
    setDebugStatusKey(successKey)
    logDebugEvent('debug.report.copy.start', {
      conversationId: conversation.id,
      messageCount: messages.length,
      kind,
    })

    try {
      await Clipboard.setStringAsync(report)
      logDebugEvent('debug.report.copy.success', {
        conversationId: conversation.id,
        reportLength: report.length,
        kind,
      })
      setDebugSheetVisible(false)
      Alert.alert(t('settings.devMode'), t(successKey))
      setTimeout(() => setDebugCopied(false), 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logDebugEvent('debug.report.copy.failed', {
        conversationId: conversation.id,
        kind,
        error: errorMessage,
      })
      setDebugCopied(false)
      setDebugCopyError(true)
      setDebugStatusKey('settings.debugCopyFailed')
      Alert.alert(t('settings.devMode'), `${t('settings.debugCopyFailed')}\n${errorMessage}`)
      setTimeout(() => setDebugCopyError(false), 3000)
    }
  }, [conversation.id, messages.length, t])

  const handleCopyFullDebug = useCallback(() => copyDebugReport(
    'full',
    buildDebugReport(debugContext, debugLayout),
    'settings.debugCopied',
  ), [copyDebugReport, debugContext, debugLayout])

  const handleCopyNetworkDebug = useCallback(() => copyDebugReport(
    'network',
    buildNetworkDebugReport(debugContext),
    'settings.debugNetworkCopied',
  ), [copyDebugReport, debugContext])

  const handleCopyLayoutDebug = useCallback(() => copyDebugReport(
    'layout',
    buildLayoutDebugReport(debugLayout),
    'settings.debugLayoutCopied',
  ), [copyDebugReport, debugLayout])

  const handleClearDebug = useCallback(() => {
    clearDebugEvents()
    logDebugEvent('debug.events.cleared', {
      conversationId: conversation.id,
    })
    setDebugSheetVisible(false)
    setDebugStatusKey('settings.debugCleared')
    Alert.alert(t('settings.devMode'), t('settings.debugCleared'))
  }, [conversation.id, t])

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      onLayout={recordLayout('thread')}
    >
      {/* Header */}
      <View
        style={[styles.header, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}
        onLayout={recordLayout('header')}
      >
        {onBack && (
          <Pressable
            style={({ pressed }) => [
              styles.headerButton,
              styles.headerBackButton,
              { backgroundColor: colors.bg, borderColor: colors.border },
              pressed && { backgroundColor: colors.bgHover },
            ]}
            onPress={onBack}
            hitSlop={12}
          >
            <ArrowLeft size={20} color={colors.textSecondary} />
          </Pressable>
        )}

        {/* Title area */}
        <Pressable style={styles.titleArea} onPress={onSettings}>
          {isGroup ? (
            <GroupAvatar participants={conversation.participants} size={36} />
          ) : (
            <EntityAvatar entity={otherParticipant} size="sm" showStatus presenceState={presenceState} />
          )}

          <View style={styles.titleContent}>
            <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
              {conversation.title || entityDisplayName(otherParticipant)}
            </Text>
            <Text style={[styles.subtitleText, { color: colors.textMuted }]}>
              {isGroup
                ? t('conversation.participants', { count: conversation.participants?.length || 0 })
                : presenceState === 'online'
                  ? t('common.online')
                  : presenceState === 'offline'
                    ? t('common.offline')
                    : t('common.unknown')
              }
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions} onLayout={recordLayout('headerActions')}>
          {devMode && (debugCopied || debugCopyError) ? (
            <Text
              style={[
                styles.headerStatusText,
                { color: debugCopyError ? colors.danger : colors.success },
              ]}
              numberOfLines={1}
            >
              {debugCopyError ? t('settings.debugCopyFailed') : t(debugStatusKey || 'settings.debugCopied')}
            </Text>
          ) : null}
          {devMode ? (
            <Pressable
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: colors.bg, borderColor: colors.border },
                pressed && { backgroundColor: colors.bgHover },
              ]}
              onPress={handleOpenDebugSheet}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('message.bugReport')}
            >
              {debugCopyError ? (
                <Bug size={20} color={colors.danger} />
              ) : debugCopied ? (
                <Check size={20} color={colors.success} />
              ) : (
                <Bug size={20} color={colors.warning} />
              )}
            </Pressable>
          ) : null}
          {onToggleTasks && !isArchived ? (
            <Pressable
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: colors.bg, borderColor: colors.border },
                pressed && { backgroundColor: colors.bgHover },
              ]}
              onPress={onToggleTasks}
            >
              <ListTodo size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          {onSettings ? (
            <Pressable
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: colors.bg, borderColor: colors.border },
                pressed && { backgroundColor: colors.bgHover },
              ]}
              onPress={onSettings}
            >
              <Settings size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ConnectionStatusBar
        connected={wsConnected}
        outboxCount={outboxCount}
        outboxFailedCount={outboxFailedCount}
        lastSyncAt={lastSyncAt}
      />

      {selectionMode ? (
        <View style={[styles.selectionBar, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
          <CheckSquare size={18} color={colors.accent} />
          <Text style={[styles.selectionText, { color: colors.text }]} numberOfLines={1}>
            {t('message.selectedCount', { count: selectedMessageIds.size })}
          </Text>
          <Pressable
            style={[styles.selectionAction, { backgroundColor: colors.accent }, selectedMessageIds.size === 0 && styles.actionDisabled]}
            onPress={handleForwardSelected}
            disabled={selectedMessageIds.size === 0}
          >
            <Forward size={14} color="#ffffff" />
            <Text style={styles.selectionActionText}>{t('message.forward')}</Text>
          </Pressable>
          <Pressable style={styles.selectionCancel} onPress={clearSelection}>
            <Text style={[styles.selectionCancelText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ActionSheet
        visible={debugSheetVisible}
        onClose={() => setDebugSheetVisible(false)}
        title={t('settings.devMode')}
        options={[
          {
            label: t('settings.debugCopyFull'),
            icon: <Bug size={18} color={colors.warning} />,
            onPress: () => void handleCopyFullDebug(),
          },
          {
            label: t('settings.debugCopyNetwork'),
            onPress: () => void handleCopyNetworkDebug(),
          },
          {
            label: t('settings.debugCopyLayout'),
            onPress: () => void handleCopyLayoutDebug(),
          },
          {
            label: t('settings.debugClear'),
            icon: <ListTodo size={18} color={colors.textMuted} />,
            onPress: handleClearDebug,
          },
        ]}
      />

      <Modal
        visible={!!forwardingMessages}
        transparent
        animationType="fade"
        onRequestClose={() => !forwardSending && setForwardingMessages(null)}
      >
        <View style={styles.forwardOverlay}>
          <View style={[styles.forwardDialog, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <View style={[styles.forwardHeader, { borderBottomColor: colors.border }]}>
              <Forward size={18} color={colors.accent} />
              <View style={styles.forwardTitleArea}>
                <Text style={[styles.forwardTitle, { color: colors.text }]}>{t('message.forwardMessages')}</Text>
                <Text style={[styles.forwardSubtitle, { color: colors.textMuted }]}>
                  {t('message.selectedCount', { count: forwardingMessages?.length || 0 })}
                </Text>
              </View>
              <Pressable onPress={() => setForwardingMessages(null)} disabled={forwardSending} style={styles.forwardClose}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.forwardBody}>
              <View style={[styles.modeSwitch, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                {(['merged', 'separate'] as ForwardMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    onPress={() => setForwardMode(mode)}
                    style={[styles.modeButton, forwardMode === mode && { backgroundColor: colors.accent }]}
                  >
                    <Text style={[styles.modeButtonText, { color: forwardMode === mode ? '#ffffff' : colors.textSecondary }]}>
                      {t(`message.forwardMode.${mode}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <ScrollView style={[styles.forwardPreview, { borderColor: colors.border, backgroundColor: colors.bg }]} keyboardShouldPersistTaps="handled">
                {forwardingMessages?.map((msg) => (
                  <View key={msg.id} style={[styles.previewRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.previewMeta}>
                      <Text style={[styles.previewSender, { color: colors.text }]} numberOfLines={1}>{entityDisplayName(msg.sender)}</Text>
                      <Text style={[styles.previewTime, { color: colors.textMuted }]}>{formatForwardPreviewTime(msg.created_at)}</Text>
                    </View>
                    <Text style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={2}>
                      {getMessageForwardText(msg)}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <ScrollView style={[styles.targetList, { borderColor: colors.border }]} keyboardShouldPersistTaps="handled">
                {conversations.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.targetRow, { borderBottomColor: colors.border }, forwardTargetId === item.id && { backgroundColor: colors.accentDim }]}
                    onPress={() => setForwardTargetId(item.id)}
                  >
                    <Text style={[styles.targetTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title || `#${item.id}`}
                    </Text>
                    {forwardTargetId === item.id ? <Check size={16} color={colors.accent} /> : null}
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                value={forwardNote}
                onChangeText={setForwardNote}
                placeholder={t('message.forwardNotePlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.forwardInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              />
            </View>

            <View style={[styles.forwardFooter, { borderTopColor: colors.border }]}>
              <Pressable style={styles.footerButton} onPress={() => setForwardingMessages(null)} disabled={forwardSending}>
                <Text style={[styles.footerButtonText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.footerPrimary, { backgroundColor: colors.accent }, (!forwardTargetId || forwardSending) && styles.actionDisabled]}
                onPress={() => void submitForward()}
                disabled={!forwardTargetId || forwardSending}
              >
                <Send size={14} color="#ffffff" />
                <Text style={styles.footerPrimaryText}>{t('message.forwardSend')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
          onLayout={recordLayout('messageList')}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.accent}
                progressViewOffset={12}
              />
            ) : undefined
          }
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
      <View onLayout={recordLayout('composer')}>
        <MessageComposer
          conversationId={conversation.id}
          onSend={handleSend}
          onAudioSend={onAudioSend}
          onFileUpload={onFileUpload}
          attachmentsEnabled={wsConnected}
          onTyping={onTyping}
          placeholder={t('conversation.typeMessage')}
          participants={conversation.participants}
          isObserver={isObserver || isArchived}
          enableMentions={conversation.conv_type !== 'direct'}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          targetBot={composerTargetBot}
        />
      </View>
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
    borderWidth: 1,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 120,
    textAlign: 'right',
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
  titleContent: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 4,
  },
  selectionBar: {
    minHeight: 48,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  selectionAction: {
    minHeight: 34,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  selectionCancel: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  selectionCancelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  forwardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 18,
  },
  forwardDialog: {
    maxHeight: '82%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  forwardHeader: {
    minHeight: 58,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forwardTitleArea: {
    flex: 1,
    minWidth: 0,
  },
  forwardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  forwardSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  forwardClose: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardBody: {
    padding: 14,
    gap: 12,
  },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  forwardPreview: {
    maxHeight: 130,
    borderWidth: 1,
    borderRadius: 12,
  },
  previewRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewSender: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  previewTime: {
    fontSize: 10,
  },
  previewText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  targetList: {
    maxHeight: 180,
    borderWidth: 1,
    borderRadius: 12,
  },
  targetRow: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  forwardInput: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  forwardFooter: {
    borderTopWidth: 1,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  footerButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  footerButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerPrimary: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
