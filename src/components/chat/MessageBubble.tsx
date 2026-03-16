import React, { useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { useTheme } from '../../theme/ThemeContext'
import { EntityAvatar } from '../entity/EntityAvatar'
import { entityDisplayName, formatTime, formatFileSize, authenticatedFileUrl, isBotOrService, truncate } from '../../lib/utils'
import { getBaseUrl } from '../../lib/api'
import type { Message, Entity } from '../../lib/types'

interface MessageBubbleProps {
  message: Message
  isSelf: boolean
  showSender: boolean
  showAvatar: boolean
  token: string | null
  replyMessage?: Message
  myEntityId?: number
  onLongPress?: (message: Message) => void
  onImagePress?: (url: string) => void
  onReactionTap?: (msgId: number, emoji: string) => void
}

// Simple inline markdown: **bold**, *italic*, `code`, [text](url)
function renderTextContent(text: string, textColor: string, linkColor: string) {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*.*?\*\*|\*.*?\*|`[^`]+`|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${lastIndex}`} style={{ color: textColor }}>
          {text.slice(lastIndex, match.index)}
        </Text>
      )
    }

    const m = match[0]
    if (m.startsWith('**') && m.endsWith('**')) {
      parts.push(
        <Text key={`b-${match.index}`} style={{ color: textColor, fontWeight: '700' }}>
          {m.slice(2, -2)}
        </Text>
      )
    } else if (m.startsWith('*') && m.endsWith('*') && !m.startsWith('**')) {
      parts.push(
        <Text key={`i-${match.index}`} style={{ color: textColor, fontStyle: 'italic' }}>
          {m.slice(1, -1)}
        </Text>
      )
    } else if (m.startsWith('`') && m.endsWith('`')) {
      parts.push(
        <Text key={`c-${match.index}`} style={{ color: linkColor, fontFamily: 'monospace', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 3 }}>
          {m.slice(1, -1)}
        </Text>
      )
    } else if (match[2] && match[3]) {
      parts.push(
        <Text
          key={`l-${match.index}`}
          style={{ color: linkColor, textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL(match![3])}
        >
          {match[2]}
        </Text>
      )
    }
    lastIndex = match.index + m.length
  }

  if (lastIndex < text.length) {
    parts.push(
      <Text key={`t-${lastIndex}`} style={{ color: textColor }}>
        {text.slice(lastIndex)}
      </Text>
    )
  }

  return parts.length > 0 ? parts : <Text style={{ color: textColor }}>{text}</Text>
}

export function MessageBubble({ message, isSelf, showSender, showAvatar, token, replyMessage, myEntityId, onLongPress, onImagePress, onReactionTap }: MessageBubbleProps) {
  const { colors } = useTheme()

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onLongPress?.(message)
  }, [message, onLongPress])

  // Revoked message
  if (message.revoked_at) {
    return (
      <View style={[styles.revokedContainer, { alignItems: isSelf ? 'flex-end' : 'flex-start' }]}>
        <Text style={[styles.revokedText, { color: colors.textMuted }]}>
          Message revoked
        </Text>
      </View>
    )
  }

  // System message
  if (message.content_type === 'system') {
    return (
      <View style={styles.systemContainer}>
        <Text style={[styles.systemText, { color: colors.textMuted }]}>
          {message.layers?.summary || ''}
        </Text>
      </View>
    )
  }

  const messageText = message.layers?.data?.body as string || message.layers?.summary || ''
  const senderName = entityDisplayName(message.sender)
  const isBot = isBotOrService(message.sender)
  const bubbleColor = isSelf ? colors.bubbleSelf : colors.bubbleOther
  const textColor = isSelf ? '#ffffff' : colors.textPrimary
  const secondaryTextColor = isSelf ? 'rgba(255,255,255,0.6)' : colors.textMuted
  const linkColor = isSelf ? '#c7d2fe' : colors.accentLight

  // Image attachments
  const imageAttachments = (message.attachments || []).filter(
    (a) => a.mime_type?.startsWith('image/') || a.type === 'image'
  )
  const fileAttachments = (message.attachments || []).filter(
    (a) => !a.mime_type?.startsWith('image/') && a.type !== 'image' && a.type !== 'audio'
  )
  const audioAttachments = (message.attachments || []).filter(
    (a) => a.mime_type?.startsWith('audio/') || a.type === 'audio'
  )

  // Client state indicator
  const clientStateText = message.client_state === 'sending' ? 'Sending...' :
    message.client_state === 'failed' ? 'Failed' :
    message.client_state === 'queued' ? 'Queued' : null

  return (
    <View style={[
      styles.row,
      { flexDirection: isSelf ? 'row-reverse' : 'row' },
    ]}>
      {/* Avatar */}
      {!isSelf && (
        <View style={styles.avatarCol}>
          {showAvatar ? (
            <EntityAvatar entity={message.sender} size="sm" />
          ) : (
            <View style={{ width: 32 }} />
          )}
        </View>
      )}

      <View style={[styles.bubbleCol, { alignItems: isSelf ? 'flex-end' : 'flex-start' }]}>
        {/* Sender name */}
        {showSender && !isSelf && (
          <Text style={[styles.senderName, { color: isBot ? colors.bot : colors.accentLight }]}>
            {senderName}
          </Text>
        )}

        <Pressable
          onLongPress={handleLongPress}
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              borderTopLeftRadius: !isSelf && !showAvatar ? 4 : 16,
              borderTopRightRadius: isSelf && !showSender ? 4 : 16,
              maxWidth: '85%',
            },
          ]}
        >
          {/* Reply-to preview */}
          {replyMessage && (
            <View style={[styles.replyPreview, { borderLeftColor: colors.accent, backgroundColor: isSelf ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.replySender, { color: colors.accent }]} numberOfLines={1}>
                {entityDisplayName(replyMessage.sender)}
              </Text>
              <Text style={[styles.replyText, { color: secondaryTextColor }]} numberOfLines={1}>
                {truncate((replyMessage.layers?.data?.body as string) || replyMessage.layers?.summary || '', 60)}
              </Text>
            </View>
          )}

          {/* Text content */}
          {messageText.length > 0 && (
            <Text style={[styles.messageText, { color: textColor }]}>
              {renderTextContent(messageText, textColor, linkColor)}
            </Text>
          )}

          {/* Image attachments */}
          {imageAttachments.map((att, i) => {
            const imgUrl = authenticatedFileUrl(att.url, token, getBaseUrl())
            return (
              <Pressable
                key={i}
                onPress={() => imgUrl && onImagePress?.(imgUrl)}
                style={styles.imageContainer}
              >
                <Image
                  source={{ uri: imgUrl }}
                  style={styles.attachedImage}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            )
          })}

          {/* Audio attachments */}
          {audioAttachments.map((att, i) => (
            <Pressable
              key={`audio-${i}`}
              onPress={() => {
                const url = authenticatedFileUrl(att.url, token, getBaseUrl())
                if (url) Linking.openURL(url)
              }}
              style={[styles.fileAttachment, { backgroundColor: isSelf ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)' }]}
            >
              <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
                {'\u{1F3B5} '}{att.filename || 'Audio'}
              </Text>
              {att.duration !== undefined && (
                <Text style={[styles.fileSize, { color: secondaryTextColor }]}>
                  {Math.floor(att.duration / 60)}:{String(Math.floor(att.duration % 60)).padStart(2, '0')}
                </Text>
              )}
            </Pressable>
          ))}

          {/* File attachments */}
          {fileAttachments.map((att, i) => (
            <Pressable
              key={i}
              onPress={() => {
                const url = authenticatedFileUrl(att.url, token, getBaseUrl())
                if (url) Linking.openURL(url)
              }}
              style={[styles.fileAttachment, { backgroundColor: isSelf ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)' }]}
            >
              <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
                {att.filename || 'File'}
              </Text>
              {att.size !== undefined && (
                <Text style={[styles.fileSize, { color: secondaryTextColor }]}>
                  {formatFileSize(att.size)}
                </Text>
              )}
            </Pressable>
          ))}

          {/* Reactions — tappable */}
          {message.reactions && message.reactions.length > 0 && (
            <View style={styles.reactions}>
              {message.reactions.map((r) => {
                const isMine = myEntityId ? r.entity_ids.includes(myEntityId) : false
                return (
                  <Pressable
                    key={r.emoji}
                    onPress={() => onReactionTap?.(message.id, r.emoji)}
                    style={[
                      styles.reactionBadge,
                      {
                        backgroundColor: isMine ? colors.accent + '25' : 'rgba(255,255,255,0.1)',
                        borderColor: isMine ? colors.accent + '50' : 'transparent',
                        borderWidth: isMine ? 1 : 0,
                      },
                    ]}
                  >
                    <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactionCount, { color: isMine ? colors.accent : secondaryTextColor }]}>{r.count}</Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          {/* Time + client state */}
          <View style={styles.metaRow}>
            <Text style={[styles.time, { color: secondaryTextColor }]}>
              {formatTime(message.created_at)}
            </Text>
            {clientStateText && (
              <Text style={[
                styles.clientState,
                { color: message.client_state === 'failed' ? colors.error : secondaryTextColor },
              ]}>
                {' '}{clientStateText}
              </Text>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  avatarCol: {
    width: 36,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubbleCol: {
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
  },
  replyPreview: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
    paddingRight: 8,
  },
  replySender: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 1,
  },
  replyText: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 11,
  },
  clientState: {
    fontSize: 11,
  },
  revokedContainer: {
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  revokedText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  systemContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  systemText: {
    fontSize: 12,
    textAlign: 'center',
  },
  imageContainer: {
    marginTop: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachedImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  fileAttachment: {
    marginTop: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  fileSize: {
    fontSize: 11,
    marginLeft: 8,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    marginLeft: 3,
  },
})
