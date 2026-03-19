import React, { useState, useCallback, useRef } from 'react'
import { View, Text, Pressable, Image, StyleSheet, Linking, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import Markdown from 'react-native-markdown-display'
import { ArtifactRenderer } from './ArtifactRenderer'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import {
  FileText, Download, Play, Pause, Ban, Clock, RotateCcw, CloudOff,
  Check, CornerUpLeft, ChevronDown, ChevronUp, Brain, Send, X, ArrowRight, Package, Bug, Eye, BarChart3,
} from 'lucide-react-native'
import { EntityAvatar } from '../ui/EntityAvatar'
import { ActionSheet, type ActionSheetOption } from '../ui/ActionSheet'
import { useThemeColors } from '../../lib/theme'
import type { Message, Entity, Attachment, InteractionLayer } from '../../lib/types'

// ─── Utility helpers ─────────────────────────────────────────────

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function isBotOrService(entity?: Entity | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

interface HandoverData {
  handover_type?: string
  task_id?: number
  deliverables?: { type: string; url?: string; value?: string }[]
  context?: {
    changes_summary?: string
    known_issues?: string[]
  }
  assign_to?: number[]
}

const handoverIcons = {
  task_completion: Package,
  bug_report: Bug,
  review_request: Eye,
  status_report: BarChart3,
} as const

function InteractionCard({
  interaction,
  onReply,
}: {
  interaction: InteractionLayer
  onReply?: (value: string, label: string) => void
}) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [responded, setResponded] = useState<string | null>(null)

  const handleReply = (value: string, label: string) => {
    setResponded(label)
    onReply?.(value, label)
  }

  if (responded) {
    return <Text style={cardStyles.respondedText}>{t('interaction.responded', { value: responded })}</Text>
  }

  if (interaction.type === 'choice') {
    return (
      <View style={cardStyles.cardSection}>
        {interaction.prompt ? <Text style={cardStyles.cardPrompt}>{interaction.prompt}</Text> : null}
        <View style={cardStyles.choiceRow}>
          {interaction.options?.map((option) => (
            <Pressable key={option.value} onPress={() => handleReply(option.value, option.label)} style={cardStyles.choiceButton}>
              <Text style={cardStyles.choiceButtonText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    )
  }

  if (interaction.type === 'confirm') {
    return (
      <View style={cardStyles.cardSection}>
        {interaction.prompt ? <Text style={cardStyles.cardPrompt}>{interaction.prompt}</Text> : null}
        <View style={cardStyles.choiceRow}>
          <Pressable onPress={() => handleReply('confirmed', t('common.confirm'))} style={cardStyles.primaryAction}>
            <Check size={12} color="#ffffff" />
            <Text style={cardStyles.primaryActionText}>{t('common.confirm')}</Text>
          </Pressable>
          <Pressable onPress={() => handleReply('cancelled', t('common.cancel'))} style={cardStyles.secondaryAction}>
            <X size={12} color="#64748b" />
            <Text style={cardStyles.secondaryActionText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  if (interaction.type === 'form') {
    return (
      <View style={cardStyles.cardSection}>
        {interaction.prompt ? <Text style={cardStyles.cardPrompt}>{interaction.prompt}</Text> : null}
        <View style={cardStyles.formRow}>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={t('interaction.inputPlaceholder')}
            placeholderTextColor="#94a3b8"
            style={cardStyles.formInput}
          />
          <Pressable
            onPress={() => inputValue.trim() && handleReply(inputValue.trim(), inputValue.trim())}
            style={[cardStyles.iconAction, !inputValue.trim() && cardStyles.iconActionDisabled]}
            disabled={!inputValue.trim()}
          >
            <Send size={12} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    )
  }

  return null
}

function HandoverCard({ message }: { message: Message }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const data = (message.layers?.data || {}) as HandoverData
  const handoverType = data.handover_type || 'task_completion'
  const Icon = handoverIcons[handoverType as keyof typeof handoverIcons] || Package

  return (
    <View style={cardStyles.handoverCard}>
      <View style={cardStyles.handoverHeader}>
        <Icon size={14} color="#6366f1" />
        <Text style={cardStyles.handoverTitle}>{t(`handover.${handoverType}`)}</Text>
        {(data.assign_to || []).length > 0 && (
          <>
            <ArrowRight size={12} color="#94a3b8" />
            <Text style={cardStyles.handoverMeta} numberOfLines={1}>
              {(data.assign_to || []).map((id) => `#${id}`).join(', ')}
            </Text>
          </>
        )}
      </View>

      <Text style={cardStyles.handoverSummary}>{message.layers?.summary || ''}</Text>

      {(data.deliverables?.length || data.context) ? (
        <Pressable onPress={() => setExpanded((prev) => !prev)} style={cardStyles.detailsToggle}>
          {expanded ? <ChevronUp size={12} color="#94a3b8" /> : <ChevronDown size={12} color="#94a3b8" />}
          <Text style={cardStyles.detailsToggleText}>{t('handover.details')}</Text>
        </Pressable>
      ) : null}

      {expanded && (
        <View style={cardStyles.detailsSection}>
          {data.deliverables && data.deliverables.length > 0 && (
            <View style={cardStyles.detailBlock}>
              <Text style={cardStyles.detailLabel}>{t('handover.deliverables')}</Text>
              {data.deliverables.map((deliverable, index) => (
                <Text key={index} style={cardStyles.detailText}>
                  {deliverable.type}: {deliverable.url || deliverable.value || '-'}
                </Text>
              ))}
            </View>
          )}
          {data.context?.changes_summary ? (
            <View style={cardStyles.detailBlock}>
              <Text style={cardStyles.detailText}>{data.context.changes_summary}</Text>
            </View>
          ) : null}
          {data.context?.known_issues && data.context.known_issues.length > 0 && (
            <View style={cardStyles.detailBlock}>
              <Text style={cardStyles.detailLabel}>{t('handover.knownIssues')}</Text>
              {data.context.known_issues.map((issue, index) => (
                <Text key={index} style={cardStyles.detailText}>• {issue}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {data.task_id ? <Text style={cardStyles.linkedTask}>{t('handover.linkedTask', { id: data.task_id })}</Text> : null}
    </View>
  )
}

// ─── Audio Player ────────────────────────────────────────────────

function AudioPlayer({ duration: totalDuration }: { url?: string; duration?: number }) {
  const [playing, setPlaying] = useState(false)
  const dur = totalDuration || 0

  // Simplified waveform bars
  const barHeights = Array.from({ length: 24 }, (_, i) =>
    12 + Math.sin(i * 0.7) * 10 + ((i * 7 + 3) % 6)
  )

  return (
    <View style={audioStyles.container}>
      <Pressable
        style={audioStyles.playButton}
        onPress={() => setPlaying(!playing)}
      >
        {playing
          ? <Pause size={14} color="#6366f1" />
          : <Play size={14} color="#6366f1" />
        }
      </Pressable>
      <View style={audioStyles.waveform}>
        {barHeights.map((h, i) => (
          <View
            key={i}
            style={[
              audioStyles.bar,
              { height: h, backgroundColor: '#6366f14D' },
            ]}
          />
        ))}
      </View>
      {dur > 0 && (
        <Text style={audioStyles.duration}>
          {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, '0')}
        </Text>
      )}
    </View>
  )
}

const audioStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 180,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  waveform: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  bar: {
    flex: 1,
    borderRadius: 99,
  },
  duration: {
    fontSize: 10,
    color: '#94a3b8',
    flexShrink: 0,
  },
})

// ─── Image Lightbox ──────────────────────────────────────────────

function ImageLightbox({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={lightboxStyles.overlay} onPress={onClose}>
        <Image
          source={{ uri }}
          style={lightboxStyles.image}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  )
}

const lightboxStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '90%',
    height: '80%',
  },
})

// ─── MessageBubble Props ─────────────────────────────────────────

interface Props {
  message: Message
  isSelf: boolean
  myEntityId?: number
  replyMessage?: Message
  onRevoke?: (msgId: number) => void
  onReply?: (msg: Message) => void
  onReact?: (msgId: number, emoji: string) => void
  onRespondInteraction?: (msgId: number, value: string, label: string) => void
  onRetryOutbox?: (tempId: string) => void
  showSender?: boolean
  isRead?: boolean
}

// ─── Component ───────────────────────────────────────────────────

export function MessageBubble({
  message,
  isSelf,
  myEntityId,
  replyMessage,
  onRevoke,
  onReply,
  onReact,
  onRespondInteraction,
  onRetryOutbox,
  showSender = true,
  isRead,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const [showThinking, setShowThinking] = useState(false)
  const [lightboxUri, setLightboxUri] = useState<string | null>(null)
  const [showActionSheet, setShowActionSheet] = useState(false)

  const layers = message?.layers || {}
  const isRevoked = !!message?.revoked_at
  const isBot = isBotOrService(message?.sender)
  const isMentioned = myEntityId != null && (message?.mentions || []).includes(myEntityId)

  // Can revoke within 2 minutes
  const canRevoke = isSelf && !isRevoked && !!onRevoke &&
    (Date.now() - new Date(message.created_at).getTime()) < 2 * 60 * 1000
  const canReply = !isRevoked && !!onReply
  const canReact = !isRevoked && !!onReact
  const canRetryOutbox = isSelf && !!message.temp_id && message.client_state !== 'sending' && !!onRetryOutbox

  const handleLongPress = useCallback(() => {
    if (isRevoked) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowActionSheet(true)
  }, [isRevoked])

  // Build action sheet options
  const actionOptions: ActionSheetOption[] = []
  // Copy
  const summary = (layers?.data?.body as string) || layers?.summary || ''
  if (summary) {
    actionOptions.push({
      label: t('message.copyText'),
      onPress: () => { Clipboard.setStringAsync(summary) },
    })
  }
  if (canReply) {
    actionOptions.push({
      label: t('chat.reply'),
      onPress: () => onReply!(message),
    })
  }
  if (canReact) {
    // Quick reactions
    const quickEmojis = ['\uD83D\uDC4D', '\u2764\uFE0F', '\uD83D\uDE02', '\uD83C\uDF89', '\uD83E\uDD14']
    quickEmojis.forEach((emoji) => {
      actionOptions.push({
        label: `React ${emoji}`,
        onPress: () => onReact!(message.id, emoji),
      })
    })
  }
  if (canRevoke) {
    actionOptions.push({
      label: t('message.revoke'),
      onPress: () => onRevoke!(message.id),
      destructive: true,
    })
  }

  // Revoked message
  if (isRevoked) {
    return (
      <View style={styles.revokedContainer}>
        <Ban size={12} color="#94a3b8" />
        <Text style={styles.revokedText}>
          {t('message.revoked', { name: entityDisplayName(message.sender) })}
        </Text>
      </View>
    )
  }

  // System message
  if (message.content_type === 'system') {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>{layers.summary}</Text>
      </View>
    )
  }

  // ─── Content renderer ────────────────────────────────────

  const renderContent = () => {
    const body = (layers?.data?.body as string) || layers?.summary || ''
    const effectiveType = (message?.content_type === 'text' && isBot) ? 'markdown' : (message?.content_type || 'text')

    switch (effectiveType) {
      case 'markdown':
        return body ? (
          <Markdown style={markdownStyles}>
            {body}
          </Markdown>
        ) : (
          <Text style={contentStyles.bodyText}> </Text>
        )

      case 'image':
        return (
          <View style={contentStyles.imageContainer}>
            {body ? <Text style={contentStyles.bodyText}>{body}</Text> : null}
            <View style={contentStyles.imageGrid}>
              {message.attachments?.map((att, i) => {
                if (!att.url) return null
                return (
                  <Pressable key={i} onPress={() => setLightboxUri(att.url!)}>
                    <Image
                      source={{ uri: att.url }}
                      style={contentStyles.imageThumb}
                    />
                  </Pressable>
                )
              })}
            </View>
          </View>
        )

      case 'audio':
        return (
          <AudioPlayer
            url={message.attachments?.[0]?.url}
            duration={message.attachments?.[0]?.duration}
          />
        )

      case 'file':
        return (
          <View style={contentStyles.fileContainer}>
            {body ? <Text style={contentStyles.bodyText}>{body}</Text> : null}
            {message.attachments?.map((att, i) => (
              <Pressable
                key={i}
                style={contentStyles.fileCard}
                onPress={() => { if (att.url) Linking.openURL(att.url) }}
              >
                <View style={contentStyles.fileIcon}>
                  <FileText size={16} color="#6366f1" />
                </View>
                <View style={contentStyles.fileInfo}>
                  <Text style={contentStyles.fileName} numberOfLines={1}>{att.filename || 'file'}</Text>
                  {att.size != null && (
                    <Text style={contentStyles.fileSize}>{formatFileSize(att.size)}</Text>
                  )}
                </View>
                <Download size={14} color="#94a3b8" />
              </Pressable>
            ))}
          </View>
        )

      case 'artifact': {
        const artifactType = (layers?.data?.artifact_type as string) || 'html'
        const artifactSource = (layers?.data?.source as string) || body
        const artifactTitle = (layers?.data?.title as string) || ''
        const artifactLang = (layers?.data?.language as string) || ''
        return (
          <View>
            {body && artifactSource !== body ? <Text style={contentStyles.bodyText}>{body}</Text> : null}
            <ArtifactRenderer
              artifactType={artifactType}
              source={artifactSource}
              title={artifactTitle}
              language={artifactLang}
            />
          </View>
        )
      }

      case 'task_handover':
        return <HandoverCard message={message} />

      default: // text
        return (
          <View>
            <Text style={contentStyles.bodyText}>{body}</Text>
            {message.attachments && message.attachments.length > 0 && (
              <View style={{ marginTop: 6, gap: 6 }}>
                {message.attachments.filter((att) => att.type === 'image').map((att, i) => (
                  att.url ? (
                    <Pressable key={`img-${i}`} onPress={() => setLightboxUri(att.url!)}>
                      <Image source={{ uri: att.url }} style={contentStyles.imageThumb} />
                    </Pressable>
                  ) : null
                ))}
                {message.attachments.filter((att) => att.type !== 'image').map((att, i) => (
                  <Pressable
                    key={`file-${i}`}
                    style={contentStyles.fileCard}
                    onPress={() => { if (att.url) Linking.openURL(att.url) }}
                  >
                    <View style={contentStyles.fileIcon}>
                      <FileText size={16} color="#6366f1" />
                    </View>
                    <View style={contentStyles.fileInfo}>
                      <Text style={contentStyles.fileName} numberOfLines={1}>{att.filename || 'file'}</Text>
                      {att.size != null && (
                        <Text style={contentStyles.fileSize}>{formatFileSize(att.size)}</Text>
                      )}
                    </View>
                    <Download size={14} color="#94a3b8" />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )
    }
  }

  // ─── Main layout ─────────────────────────────────────────

  return (
    <>
      <View style={[styles.row, isSelf && styles.rowSelf]}>
        {/* Avatar */}
        {!isSelf && (
          showSender ? (
            <EntityAvatar entity={message.sender} size="sm" />
          ) : (
            <View style={styles.avatarSpacer} />
          )
        )}

        <View style={[styles.column, isSelf && styles.columnSelf]}>
          {/* Sender + time */}
          {showSender && (
            <View style={[styles.metaRow, isSelf && styles.metaRowSelf]}>
              {!isSelf && (
                <Text style={[styles.senderName, { color: colors.textSecondary }, isBot && styles.senderBot]}>
                  {entityDisplayName(message.sender)}
                </Text>
              )}
              <Text style={[styles.timestamp, { color: colors.textMuted }]}>{formatTime(message.created_at)}</Text>
            </View>
          )}

          {/* Reply reference */}
          {message.reply_to && (
            <View style={[styles.replyRef, isSelf && styles.replyRefSelf]}>
              <CornerUpLeft size={12} color="#94a3b8" />
              {replyMessage ? (
                <View style={styles.replyCard}>
                  <Text style={styles.replyAuthor} numberOfLines={1}>
                    {entityDisplayName(replyMessage.sender)}
                  </Text>
                  <Text style={styles.replyPreview} numberOfLines={1}>
                    {(replyMessage.layers?.summary || '').slice(0, 50)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.replyFallback}>
                  {t('message.replyTo', { id: message.reply_to })}
                </Text>
              )}
            </View>
          )}

          {/* Bubble */}
          <Pressable
            onLongPress={handleLongPress}
            delayLongPress={500}
            style={({ pressed }) => [
              styles.bubble,
              isSelf
                ? [styles.bubbleSelf, { backgroundColor: colors.bubbleSelf }]
                : [styles.bubbleOther, { backgroundColor: colors.bubbleOther, borderColor: colors.bubbleBorderOther }],
              isMentioned && !isSelf && [styles.bubbleMentioned, { borderLeftColor: colors.accent }],
              message.client_state === 'sending' && styles.bubbleSending,
              pressed && styles.bubblePressed,
            ]}
          >
            {renderContent()}
          </Pressable>

          {layers.interaction && (
            <InteractionCard
              interaction={layers.interaction}
              onReply={(value, label) => onRespondInteraction?.(message.id, value, label)}
            />
          )}

          {/* Reactions */}
          {(message.reactions?.length || 0) > 0 && (
            <View style={[styles.reactionsRow, isSelf && styles.reactionsRowSelf]}>
              {message.reactions!.map((r, i) => {
                const isMine = myEntityId != null && r.entity_ids.includes(myEntityId)
                return (
                  <Pressable
                    key={i}
                    style={[styles.reactionChip, isMine && styles.reactionChipActive]}
                    onPress={() => onReact?.(message.id, r.emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactionCount, isMine && styles.reactionCountActive]}>
                      {r.count}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          {/* Delivery status */}
          {isSelf && message.temp_id && message.client_state && (
            <View style={[styles.statusRow, styles.statusRowSelf]}>
              {message.client_state === 'sending' && (
                <>
                  <Clock size={12} color="#94a3b8" />
                  <Text style={styles.statusText}>{t('message.sending')}</Text>
                </>
              )}
              {message.client_state === 'queued' && (
                <>
                  <CloudOff size={12} color="#94a3b8" />
                  <Text style={styles.statusText}>{t('message.queuedOffline')}</Text>
                  {canRetryOutbox && (
                    <Pressable onPress={() => onRetryOutbox!(message.temp_id!)}>
                      <Text style={styles.retryLink}>{t('message.retryNow')}</Text>
                    </Pressable>
                  )}
                </>
              )}
              {message.client_state === 'failed' && (
                <>
                  <RotateCcw size={12} color="#ef4444" />
                  <Text style={[styles.statusText, { color: '#ef4444' }]}>{t('message.deliveryFailed')}</Text>
                  {canRetryOutbox && (
                    <Pressable onPress={() => onRetryOutbox!(message.temp_id!)}>
                      <Text style={[styles.retryLink, { color: '#ef4444' }]}>{t('message.tapToRetry')}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}

          {/* Read receipt */}
          {isSelf && isRead && !message.temp_id && (
            <View style={[styles.statusRow, styles.statusRowSelf]}>
              <Check size={12} color="#6366f1" />
              <Text style={styles.statusText}>{t('message.read')}</Text>
            </View>
          )}

          {/* Thinking toggle */}
          {layers.thinking && (
            <View style={styles.thinkingContainer}>
              <Pressable
                style={styles.thinkingToggle}
                onPress={() => setShowThinking(!showThinking)}
              >
                <Brain size={12} color="#94a3b8" />
                <Text style={styles.thinkingLabel}>{t('message.thinking')}</Text>
                {showThinking
                  ? <ChevronUp size={12} color="#94a3b8" />
                  : <ChevronDown size={12} color="#94a3b8" />
                }
              </Pressable>
              {showThinking && (
                <View style={styles.thinkingContent}>
                  <Text style={styles.thinkingText}>{layers.thinking}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Lightbox */}
      {lightboxUri && (
        <ImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />
      )}

      {/* Action sheet */}
      <ActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        options={actionOptions}
      />
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  rowSelf: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  avatarSpacer: {
    width: 32,
    flexShrink: 0,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  columnSelf: {
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  metaRowSelf: {
    flexDirection: 'row-reverse',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  senderBot: {
    color: '#a78bfa',
  },
  timestamp: {
    fontSize: 10,
    color: '#94a3b8',
    opacity: 0.6,
  },
  replyRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  replyRefSelf: {
    flexDirection: 'row-reverse',
  },
  replyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 2,
    borderLeftColor: '#6366f140',
    maxWidth: 200,
  },
  replyAuthor: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6366f1',
    flexShrink: 1,
  },
  replyPreview: {
    fontSize: 10,
    color: '#94a3b8',
    flexShrink: 1,
  },
  replyFallback: {
    fontSize: 10,
    color: '#94a3b8',
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  bubbleSelf: {
    backgroundColor: '#eef2ff',
    borderTopRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    borderTopLeftRadius: 6,
  },
  bubbleMentioned: {
    borderLeftWidth: 2,
    borderLeftColor: '#6366f1',
    backgroundColor: '#6366f108',
  },
  bubbleSending: {
    opacity: 0.6,
  },
  bubblePressed: {
    opacity: 0.8,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 2,
  },
  reactionsRowSelf: {
    justifyContent: 'flex-end',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  reactionChipActive: {
    borderColor: '#6366f180',
    backgroundColor: '#eef2ff',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: '#94a3b8',
  },
  reactionCountActive: {
    color: '#6366f1',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  statusRowSelf: {
    justifyContent: 'flex-end',
  },
  statusText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  retryLink: {
    fontSize: 10,
    color: '#6366f1',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  thinkingContainer: {
    paddingHorizontal: 4,
  },
  thinkingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thinkingLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  thinkingContent: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    maxHeight: 128,
  },
  thinkingText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  revokedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  revokedText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  systemContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    fontSize: 11,
    color: '#94a3b8',
  },
})

const cardStyles = StyleSheet.create({
  cardSection: {
    marginTop: 10,
    gap: 8,
  },
  cardPrompt: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#818cf8',
    backgroundColor: '#eef2ff',
  },
  choiceButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4f46e5',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#6366f1',
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  secondaryActionText: {
    fontSize: 12,
    color: '#64748b',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 12,
    color: '#1e293b',
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionDisabled: {
    opacity: 0.5,
  },
  respondedText: {
    marginTop: 10,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  handoverCard: {
    minWidth: 220,
  },
  handoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  handoverTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  handoverMeta: {
    flex: 1,
    fontSize: 11,
    color: '#64748b',
  },
  handoverSummary: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1e293b',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  detailsToggleText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  detailsSection: {
    marginTop: 10,
    gap: 10,
  },
  detailBlock: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  detailText: {
    fontSize: 11,
    lineHeight: 18,
    color: '#64748b',
  },
  linkedTask: {
    marginTop: 10,
    fontSize: 10,
    color: '#94a3b8',
  },
})

const contentStyles = StyleSheet.create({
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1e293b',
  },
  imageContainer: {
    gap: 6,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  imageThumb: {
    width: 150,
    height: 150,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  fileContainer: {
    gap: 6,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff80',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e293b',
  },
  fileSize: {
    fontSize: 10,
    color: '#94a3b8',
  },
})

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1e293b',
  },
  heading1: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 4,
  },
  heading2: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 6,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 4,
    marginBottom: 2,
  },
  code_inline: {
    backgroundColor: '#f1f5f9',
    color: '#6366f1',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'Courier',
  },
  fence: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#334155',
    marginVertical: 4,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#6366f140',
    paddingLeft: 12,
    marginVertical: 4,
    backgroundColor: '#f8fafc',
    paddingVertical: 4,
    borderRadius: 4,
  },
  link: {
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
  list_item: {
    marginVertical: 2,
  },
  strong: {
    fontWeight: '600',
    color: '#0f172a',
  },
  em: {
    fontStyle: 'italic',
  },
} as Record<string, any>)
