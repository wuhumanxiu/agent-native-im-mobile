import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { EntityAvatar } from '../entity/EntityAvatar'
import { entityDisplayName } from '../../lib/utils'
import type { ActiveStream, Entity } from '../../lib/types'

interface Props {
  stream: ActiveStream
  sender?: Entity
  onCancel?: (streamId: string, conversationId: number) => void
}

export function StreamingBubble({ stream, sender, onCancel }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const [showThinking, setShowThinking] = useState(false)

  const status = stream.layers.status
  const thinking = stream.layers.thinking
  const summary = stream.layers.summary || ''
  const progress = status?.progress ?? 0

  const handleCancel = useCallback(() => {
    onCancel?.(stream.stream_id, stream.conversation_id)
  }, [stream.stream_id, stream.conversation_id, onCancel])

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarCol}>
        <EntityAvatar entity={sender} size="sm" />
      </View>

      <View style={styles.bubbleCol}>
        {/* Sender name */}
        {sender && (
          <View style={styles.headerRow}>
            <Text style={[styles.senderName, { color: colors.bot }]}>
              {entityDisplayName(sender)}
            </Text>
            <Text style={[styles.processingLabel, { color: colors.textMuted }]}>
              {t('chat.streaming')}
            </Text>
          </View>
        )}

        {/* Bubble */}
        <View style={[styles.bubble, { backgroundColor: colors.bubbleOther, borderColor: colors.borderSubtle }]}>
          {summary ? (
            <View style={styles.contentArea}>
              <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
                {summary}
              </Text>
              {/* Typing cursor */}
              <View style={[styles.cursor, { backgroundColor: colors.accent }]} />
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {status?.text || t('chat.streaming')}
              </Text>
            </View>
          )}

          {/* Progress bar */}
          {progress > 0 && (
            <View style={[styles.progressTrack, { backgroundColor: colors.bgPrimary }]}>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: colors.accent, width: `${Math.min(progress * 100, 100)}%` },
                ]}
              />
            </View>
          )}

          {/* Status text when there is content */}
          {status?.phase && summary ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.statusText, { color: colors.textMuted }]}>
                {status.text || status.phase}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Controls: thinking toggle + cancel */}
        <View style={styles.controlRow}>
          {thinking ? (
            <Pressable onPress={() => setShowThinking(!showThinking)} style={styles.controlBtn}>
              <Text style={[styles.controlText, { color: colors.textMuted }]}>
                {t('chat.thinking')} {showThinking ? '\u25B2' : '\u25BC'}
              </Text>
            </Pressable>
          ) : null}
          {onCancel && (
            <Pressable onPress={handleCancel} style={styles.controlBtn}>
              <Text style={[styles.controlText, { color: colors.error }]}>
                {t('chat.streamStop')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Expanded thinking */}
        {showThinking && thinking ? (
          <View style={[styles.thinkingBox, { backgroundColor: colors.bgTertiary }]}>
            <Text style={[styles.thinkingText, { color: colors.textMuted }]}>
              {thinking}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  avatarCol: {
    width: 36,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  bubbleCol: {
    flex: 1,
    maxWidth: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    paddingLeft: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
  },
  processingLabel: {
    fontSize: 10,
  },
  bubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  contentArea: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 21,
  },
  cursor: {
    width: 2,
    height: 16,
    marginLeft: 2,
    borderRadius: 1,
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  progressTrack: {
    height: 3,
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  statusText: {
    fontSize: 10,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 4,
    marginTop: 4,
  },
  controlBtn: {
    paddingVertical: 2,
  },
  controlText: {
    fontSize: 11,
    fontWeight: '500',
  },
  thinkingBox: {
    marginTop: 4,
    marginLeft: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxHeight: 100,
  },
  thinkingText: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
})
