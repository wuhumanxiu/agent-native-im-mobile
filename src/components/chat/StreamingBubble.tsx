import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import Markdown from 'react-native-markdown-display'
import { Brain, ChevronDown, ChevronUp, Square } from 'lucide-react-native'
import { EntityAvatar } from '../ui/EntityAvatar'
import { ProcessingDots } from './ThinkingBubble'
import type { ActiveStream, Entity } from '../../lib/types'

// ─── Cursor blink ────────────────────────────────────────────────

function BlinkingCursor() {
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View
      style={{
        width: 2,
        height: 16,
        backgroundColor: '#6366f1',
        marginLeft: 2,
        opacity,
      }}
    />
  )
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  stream: ActiveStream
  sender?: Entity
  onCancel?: (streamId: string, conversationId: number) => void
}

// ─── Component ───────────────────────────────────────────────────

export function StreamingBubble({ stream, sender, onCancel }: Props) {
  const { t } = useTranslation()
  const [showThinking, setShowThinking] = useState(false)

  const streamLayers = stream?.layers || {}
  const status = streamLayers.status
  const thinking = streamLayers.thinking
  const summary = streamLayers.summary || ''
  const progress = status?.progress ?? 0

  return (
    <View style={styles.row}>
      {/* Avatar */}
      <EntityAvatar entity={sender} size="sm" />

      <View style={styles.column}>
        {/* Sender name */}
        {sender && (
          <View style={styles.metaRow}>
            <Text style={styles.senderName}>
              {sender.display_name || sender.name}
            </Text>
            <Text style={styles.statusLabel}>
              {t('streaming.processing')}
            </Text>
          </View>
        )}

        {/* Bubble */}
        <View style={styles.bubble}>
          {/* Content */}
          <View style={styles.contentArea}>
            {summary ? (
              <View style={styles.markdownContainer}>
                <Markdown style={markdownStyles}>{summary}</Markdown>
                <BlinkingCursor />
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <ProcessingDots color="#6366f1" />
                <Text style={styles.loadingText}>
                  {status?.text || t('streaming.processing')}
                </Text>
              </View>
            )}
          </View>

          {/* Status bar with progress */}
          {(status?.phase || progress > 0) && (
            <View style={styles.statusBar}>
              {status?.phase && summary ? (
                <View style={styles.phaseRow}>
                  <ProcessingDots color="#6366f1" />
                  <Text style={styles.phaseText}>{status.text || status.phase}</Text>
                </View>
              ) : null}
              {progress > 0 && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(progress * 100, 100)}%` as any },
                    ]}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Controls: thinking + cancel */}
        <View style={styles.controlsRow}>
          {thinking && (
            <Pressable
              style={styles.controlButton}
              onPress={() => setShowThinking(!showThinking)}
            >
              <Brain size={12} color="#94a3b8" />
              <Text style={styles.controlText}>{t('message.thinking')}</Text>
              {showThinking
                ? <ChevronUp size={12} color="#94a3b8" />
                : <ChevronDown size={12} color="#94a3b8" />
              }
            </Pressable>
          )}
          {onCancel && (
            <Pressable
              style={styles.controlButton}
              onPress={() => onCancel(stream.stream_id, stream.conversation_id)}
            >
              <Square size={10} color="#94a3b8" />
              <Text style={styles.cancelText}>{t('chat.stopGenerating')}</Text>
            </Pressable>
          )}
        </View>

        {/* Expanded thinking */}
        {showThinking && thinking && (
          <View style={styles.thinkingExpanded}>
            <Text style={styles.thinkingText}>{thinking}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    maxWidth: '85%',
  },
  column: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#a78bfa',
  },
  statusLabel: {
    fontSize: 10,
    color: '#94a3b8',
    opacity: 0.6,
  },
  bubble: {
    borderRadius: 20,
    borderTopLeftRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  contentArea: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 200,
  },
  markdownContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
  },
  statusBar: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 6,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phaseText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#6366f1',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  cancelText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  thinkingExpanded: {
    marginHorizontal: 4,
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
})

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1e293b',
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
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#334155',
  },
  link: {
    color: '#6366f1',
  },
  strong: {
    fontWeight: '600',
  },
} as Record<string, any>)
