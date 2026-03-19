import React, { useCallback, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Users, VolumeX, Pin } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { EntityAvatar } from '../ui/EntityAvatar'
import { ActionSheet, type ActionSheetOption } from '../ui/ActionSheet'
import { useThemeColors } from '../../lib/theme'
import type { Conversation, Entity } from '../../lib/types'

// ─── Utility helpers (mirrors web utils.ts) ──────────────────────

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '...'
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHr < 24) return `${diffHr}h`
  if (diffDay < 7) return `${diffDay}d`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  conv: Conversation
  active: boolean
  myEntityId: number
  isMuted?: boolean
  onPress: () => void
  onToggleMute?: (id: number) => void
  onPin?: (id: number) => void
  onUnpin?: (id: number) => void
  onArchive?: (id: number) => void
  onLeave?: (id: number) => void
  isArchived?: boolean
  onUnarchive?: (id: number) => void
}

export function ConversationItem({
  conv,
  active,
  myEntityId,
  isMuted = false,
  onPress,
  onToggleMute,
  onPin,
  onUnpin,
  onArchive,
  onLeave,
  isArchived,
  onUnarchive,
}: Props) {
  const colors = useThemeColors()
  const [showMenu, setShowMenu] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isGroup = conv.conv_type === 'group' || conv.conv_type === 'channel'
  const myParticipant = conv.participants?.find((p) => p.entity_id === myEntityId)
  const otherParticipant = conv.participants?.find((p) => p.entity_id !== myEntityId)?.entity
  const title = conv.title || entityDisplayName(otherParticipant)
  const lastMsg = conv.last_message
  const lastText = lastMsg?.layers?.summary
    || (lastMsg?.content_type === 'image' ? '[Image]'
    : lastMsg?.content_type === 'file' ? '[File]'
    : lastMsg?.content_type === 'audio' ? '[Audio]'
    : '')
  const hasUnread = !isMuted && (conv.unread_count || 0) > 0
  const unreadCount = conv.unread_count || 0
  const isPinned = !!myParticipant?.pinned_at

  // Sender prefix for last message
  const lastMsgSenderName = (() => {
    if (!lastMsg?.sender) return ''
    if (lastMsg.sender_id === myEntityId) return 'You'
    const name = entityDisplayName(lastMsg.sender)
    return name.length > 6 ? name.slice(0, 6) : name
  })()

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowMenu(true)
  }, [])

  // Build action sheet options
  const menuOptions: ActionSheetOption[] = []
  if (!isArchived && (isPinned ? onUnpin : onPin)) {
    menuOptions.push({
      label: isPinned ? 'Unpin' : 'Pin',
      onPress: () => (isPinned ? onUnpin : onPin)?.(conv.id),
    })
  }
  if (onToggleMute) {
    menuOptions.push({
      label: isMuted ? 'Unmute' : 'Mute',
      onPress: () => onToggleMute(conv.id),
    })
  }
  if (!isArchived && onArchive) {
    menuOptions.push({
      label: 'Archive',
      onPress: () => onArchive(conv.id),
    })
  }
  if (isArchived && onUnarchive) {
    menuOptions.push({
      label: 'Unarchive',
      onPress: () => onUnarchive(conv.id),
    })
  }
  if (isGroup && myParticipant?.role !== 'owner' && onLeave) {
    menuOptions.push({
      label: 'Leave',
      onPress: () => onLeave(conv.id),
      destructive: true,
    })
  }

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: active ? colors.accentDim : colors.bgSecondary,
            borderColor: active ? colors.accent : colors.border,
          },
          pressed && !active && { backgroundColor: colors.bgHover },
        ]}
      >
        {/* Avatar */}
        {isGroup ? (
          <View style={styles.groupAvatarContainer}>
            <View style={[styles.groupAvatar, { backgroundColor: colors.accentDim, borderColor: colors.border }]}>
              <Users size={18} color={colors.accent} />
            </View>
          </View>
        ) : (
          <EntityAvatar entity={otherParticipant} size="md" />
        )}

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: colors.text }, hasUnread && styles.titleUnread]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {isPinned && <Pin size={12} color={colors.accent} />}
              {isMuted && <VolumeX size={12} color={colors.textMuted} />}
            </View>
            {(lastMsg?.created_at || conv.updated_at) && (
              <Text style={[styles.time, { color: colors.textMuted }]}>
                {formatRelativeTime(lastMsg?.created_at || conv.updated_at)}
              </Text>
            )}
          </View>
          {lastText ? (
            <Text
              style={[styles.preview, { color: colors.textMuted }, hasUnread && { color: colors.textSecondary, fontWeight: '500' }]}
              numberOfLines={1}
            >
              {lastMsgSenderName ? (
                <>
                  <Text style={{ color: hasUnread ? colors.text : colors.textSecondary }}>
                    {lastMsgSenderName}:{' '}
                  </Text>
                  {truncate(lastText, 45)}
                </>
              ) : (
                truncate(lastText, 45)
              )}
            </Text>
          ) : (
            <Text style={styles.previewEmpty}> </Text>
          )}
        </View>

        {/* Unread badge */}
        {!isMuted && unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.unreadText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
        {isMuted && unreadCount > 0 && (
          <View style={styles.mutedDot} />
        )}
      </Pressable>

      <ActionSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        options={menuOptions}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    marginHorizontal: 8,
    borderWidth: 1,
  },
  active: {
    backgroundColor: '#eff6ff',
  },
  pressed: {
    backgroundColor: '#f8fafc',
  },
  groupAvatarContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    flexShrink: 1,
  },
  titleUnread: {
    fontWeight: '600',
  },
  time: {
    fontSize: 10,
    color: '#94a3b8',
    flexShrink: 0,
  },
  preview: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 18,
  },
  previewUnread: {
    color: '#64748b',
    fontWeight: '500',
  },
  previewEmpty: {
    fontSize: 12,
    color: 'transparent',
    marginTop: 2,
  },
  senderPrefix: {
    color: '#64748b',
  },
  senderPrefixUnread: {
    color: '#1e293b',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  mutedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94a3b880',
    flexShrink: 0,
  },
})
