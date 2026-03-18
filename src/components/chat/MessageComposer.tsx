import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Send, Paperclip, X, Mic, MicOff, Smile, CornerUpLeft, Loader2, Image as ImageIcon, FileText, CheckCircle, RotateCw } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { EntityAvatar } from '../ui/EntityAvatar'
import { storage } from '../../lib/storage'
import { useThemeColors } from '../../lib/theme'
import type { Participant, Message, Attachment } from '../../lib/types'

// ─── Utility ─────────────────────────────────────────────────────

function entityDisplayName(entity?: { display_name?: string; name?: string } | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name || 'Unknown'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ─── Types ───────────────────────────────────────────────────────

export interface PendingFile {
  uri: string
  name: string
  type: string
  size: number
  status: 'uploading' | 'uploaded' | 'failed'
  url?: string
}

export type UploadedAttachment = Required<Pick<Attachment, 'type' | 'url' | 'filename' | 'mime_type' | 'size'>>

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  conversationId?: number
  onSend: (text: string, attachments?: UploadedAttachment[], mentions?: number[]) => void
  onAudioSend?: (blob: any, duration: number) => void
  onFileUpload?: (file: { uri: string; name: string; type: string; size: number }) => Promise<string | null>
  onTyping?: () => void
  placeholder?: string
  participants?: Participant[]
  isObserver?: boolean
  replyTo?: Message | null
  onCancelReply?: () => void
  disabled?: boolean
}

// ─── Component ───────────────────────────────────────────────────

export function MessageComposer({
  conversationId,
  onSend,
  onAudioSend,
  onFileUpload,
  onTyping,
  placeholder,
  participants,
  isObserver,
  replyTo,
  onCancelReply,
  disabled,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [mentionIds, setMentionIds] = useState<number[]>([])
  const [inputHeight, setInputHeight] = useState(40)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const textInputRef = useRef<TextInput>(null)

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)

  // Typing indicator throttle
  const lastTypingRef = useRef(0)
  const emitTyping = useCallback(() => {
    if (!onTyping) return
    const now = Date.now()
    if (now - lastTypingRef.current > 3000) {
      lastTypingRef.current = now
      onTyping()
    }
  }, [onTyping])

  // ─── Draft persistence ───────────────────────────────────────
  const draftKey = conversationId ? `aim_draft_${conversationId}` : null

  // Restore draft on mount / conversation switch
  const prevConvIdRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (conversationId !== prevConvIdRef.current) {
      // Save previous draft before switching
      if (prevConvIdRef.current != null) {
        const prevKey = `aim_draft_${prevConvIdRef.current}`
        const prevText = text.trim()
        if (prevText) {
          storage.set(prevKey, prevText)
        } else {
          storage.delete(prevKey)
        }
      }

      // Load draft for new conversation
      const newDraftKey = conversationId ? `aim_draft_${conversationId}` : null
      const savedDraft = newDraftKey ? storage.getString(newDraftKey) : undefined
      setText(savedDraft || '')
      setPendingFiles([])
      setMentionIds([])
      setMentionQuery(null)
      prevConvIdRef.current = conversationId
    }
  }, [conversationId])

  // Save draft on unmount
  useEffect(() => {
    return () => {
      if (draftKey) {
        const trimmed = text.trim()
        if (trimmed) {
          storage.set(draftKey, trimmed)
        } else {
          storage.delete(draftKey)
        }
      }
    }
  }, [draftKey, text])

  // Focus input when reply is set
  useEffect(() => {
    if (replyTo) textInputRef.current?.focus()
  }, [replyTo])

  // Filter participants by mention query
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null || !participants) return []
    const q = mentionQuery.toLowerCase()
    return participants
      .filter((p) => p.entity)
      .filter((p) => {
        const name = p.entity!.name.toLowerCase()
        const display = (p.entity!.display_name || '').toLowerCase()
        return name.includes(q) || display.includes(q)
      })
      .slice(0, 8)
  }, [mentionQuery, participants])

  useEffect(() => {
    setMentionIndex(0)
  }, [mentionCandidates.length])

  const insertMention = useCallback((participant: Participant) => {
    if (!participant.entity || mentionStart < 0) return
    const before = text.slice(0, mentionStart)
    const displayName = entityDisplayName(participant.entity)
    const newText = `${before}@${displayName} `
    setText(newText)
    setMentionIds((prev) => prev.includes(participant.entity_id) ? prev : [...prev, participant.entity_id])
    setMentionQuery(null)
    setMentionStart(-1)
  }, [text, mentionStart])

  // Uploaded attachments
  const uploadedAttachments: UploadedAttachment[] = useMemo(() =>
    pendingFiles
      .filter((pf): pf is PendingFile & { url: string } => pf.status === 'uploaded' && !!pf.url)
      .map((pf) => ({
        type: pf.type.startsWith('image/') ? 'image' : 'file',
        url: pf.url,
        filename: pf.name,
        mime_type: pf.type,
        size: pf.size,
      })),
  [pendingFiles])

  const hasUploading = pendingFiles.some((pf) => pf.status === 'uploading')

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && uploadedAttachments.length === 0) return
    if (hasUploading) return
    onSend(trimmed, uploadedAttachments.length > 0 ? uploadedAttachments : undefined, mentionIds.length > 0 ? mentionIds : undefined)
    setText('')
    setPendingFiles([])
    setMentionIds([])
    setMentionQuery(null)
    // Clear draft on send
    if (draftKey) storage.delete(draftKey)
    textInputRef.current?.focus()
  }, [text, uploadedAttachments, hasUploading, mentionIds, onSend])

  // Handle text change with @mention detection
  const handleTextChange = useCallback((value: string) => {
    setText(value)
    emitTyping()

    // Detect @mention trigger
    const atMatch = value.match(/(^|[^a-zA-Z0-9])@([^\s@]*)$/)
    if (atMatch && participants && participants.length > 0) {
      setMentionQuery(atMatch[2])
      setMentionStart(value.length - atMatch[2].length - 1)
    } else {
      setMentionQuery(null)
      setMentionStart(-1)
    }
  }, [emitTyping, participants])

  // ─── Audio recording ──────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!onAudioSend) return
    try {
      const { granted } = await Audio.requestPermissionsAsync()
      if (!granted) return

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await recording.startAsync()
      recordingRef.current = recording
      setIsRecording(true)
      setRecordingDuration(0)

      // Duration timer
      const startTime = Date.now()
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    } catch (err) {
      console.warn('[AudioRecording] Failed to start:', err)
    }
  }, [onAudioSend])

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      await recordingRef.current.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })

      const uri = recordingRef.current.getURI()
      const status = await recordingRef.current.getStatusAsync()
      const durationMs = status.durationMillis || 0

      recordingRef.current = null
      setIsRecording(false)
      setRecordingDuration(0)

      if (uri && durationMs > 500 && onAudioSend) {
        onAudioSend(uri, Math.round(durationMs / 1000))
      }
    } catch (err) {
      console.warn('[AudioRecording] Failed to stop:', err)
      recordingRef.current = null
      setIsRecording(false)
      setRecordingDuration(0)
    }
  }, [onAudioSend])

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      await recordingRef.current.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
    } catch { /* already stopped */ }
    recordingRef.current = null
    setIsRecording(false)
    setRecordingDuration(0)
  }, [])

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {})
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [])

  // Image/file picker
  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (result.canceled || !result.assets) return
    if (!onFileUpload) return

    for (const asset of result.assets) {
      const name = asset.fileName || `image_${Date.now()}.jpg`
      const type = asset.mimeType || 'image/jpeg'
      const size = asset.fileSize || 0
      const entry: PendingFile = {
        uri: asset.uri,
        name,
        type,
        size,
        status: 'uploading',
      }
      setPendingFiles((prev) => [...prev, entry])

      onFileUpload({ uri: asset.uri, name, type, size }).then((url) => {
        setPendingFiles((prev) =>
          prev.map((pf) =>
            pf.uri === asset.uri
              ? { ...pf, status: url ? 'uploaded' : 'failed', url: url ?? undefined }
              : pf
          )
        )
      })
    }
  }, [onFileUpload])

  const removeFile = useCallback((uri: string) => {
    setPendingFiles((prev) => prev.filter((pf) => pf.uri !== uri))
  }, [])

  // Observer state
  if (isObserver) {
    return (
      <View style={styles.observerContainer}>
        <Text style={styles.observerText}>{t('conversation.observer')}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border }]}>
      {/* @mention autocomplete */}
      {mentionQuery !== null && mentionCandidates.length > 0 && (
        <View style={styles.mentionPopover}>
          <FlatList
            data={mentionCandidates}
            keyExtractor={(p) => String(p.entity_id)}
            keyboardShouldPersistTaps="always"
            renderItem={({ item, index }) => (
              <Pressable
                style={[
                  styles.mentionItem,
                  index === mentionIndex && styles.mentionItemActive,
                ]}
                onPress={() => insertMention(item)}
              >
                <EntityAvatar entity={item.entity} size="xs" />
                <View style={styles.mentionInfo}>
                  <Text style={styles.mentionName} numberOfLines={1}>
                    {entityDisplayName(item.entity)}
                  </Text>
                  <Text style={styles.mentionHandle}>
                    @{item.entity?.name}
                    {item.entity?.entity_type !== 'user' && (
                      <Text style={styles.mentionBadge}> {item.entity?.entity_type}</Text>
                    )}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={styles.replyBar}>
          <CornerUpLeft size={14} color="#6366f1" />
          <View style={styles.replyContent}>
            <Text style={styles.replyAuthor}>
              {t('chat.replyTo', { name: entityDisplayName(replyTo.sender) })}
            </Text>
            <Text style={styles.replyPreview} numberOfLines={1}>
              {(replyTo.layers?.summary || '').slice(0, 80)}
            </Text>
          </View>
          <Pressable style={styles.replyCancelButton} onPress={onCancelReply}>
            <X size={12} color="#94a3b8" />
          </Pressable>
        </View>
      )}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <View style={styles.filesRow}>
          {pendingFiles.map((pf) => (
            <View
              key={pf.uri}
              style={[
                styles.fileChip,
                pf.status === 'uploaded' && styles.fileChipUploaded,
                pf.status === 'failed' && styles.fileChipFailed,
              ]}
            >
              {/* File type icon */}
              {pf.type.startsWith('image/') ? (
                <ImageIcon size={14} color={pf.status === 'failed' ? '#ef4444' : '#6366f1'} />
              ) : (
                <FileText size={14} color={pf.status === 'failed' ? '#ef4444' : '#6366f1'} />
              )}
              <Text style={[styles.fileChipName, pf.status === 'failed' && styles.fileChipNameFailed]} numberOfLines={1}>{pf.name}</Text>
              <Text style={styles.fileChipSize}>{formatFileSize(pf.size)}</Text>
              {/* Status indicator */}
              {pf.status === 'uploading' && (
                <ActivityIndicator size="small" color="#6366f1" style={{ width: 14, height: 14 }} />
              )}
              {pf.status === 'uploaded' && (
                <CheckCircle size={14} color="#16a34a" />
              )}
              {pf.status === 'failed' && (
                <Pressable
                  onPress={() => {
                    if (!onFileUpload) return
                    setPendingFiles((prev) =>
                      prev.map((f) => f.uri === pf.uri ? { ...f, status: 'uploading' } : f)
                    )
                    onFileUpload({ uri: pf.uri, name: pf.name, type: pf.type, size: pf.size }).then((url) => {
                      setPendingFiles((prev) =>
                        prev.map((f) =>
                          f.uri === pf.uri
                            ? { ...f, status: url ? 'uploaded' : 'failed', url: url ?? undefined }
                            : f
                        )
                      )
                    })
                  }}
                  hitSlop={8}
                >
                  <RotateCw size={14} color="#ef4444" />
                </Pressable>
              )}
              <Pressable onPress={() => removeFile(pf.uri)} hitSlop={8}>
                <X size={12} color={pf.status === 'failed' ? '#ef4444' : '#94a3b8'} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Mention badges */}
      {mentionIds.length > 0 && participants && (
        <View style={styles.mentionBadgesRow}>
          {mentionIds.map((eid) => {
            const p = participants.find((pp) => pp.entity_id === eid)
            return (
              <View key={eid} style={styles.mentionBadgeChip}>
                <Text style={styles.mentionBadgeText}>@{entityDisplayName(p?.entity)}</Text>
                <Pressable onPress={() => setMentionIds((prev) => prev.filter((id) => id !== eid))}>
                  <X size={10} color="#6366f1" />
                </Pressable>
              </View>
            )
          })}
        </View>
      )}

      {/* Quick emoji picker */}
      {showEmojiPicker && (
        <View style={[styles.emojiGrid, { backgroundColor: colors.bgTertiary, borderColor: colors.border }]}>
          {[
            '\uD83D\uDE00', '\uD83D\uDE02', '\uD83D\uDE0D', '\uD83E\uDD29', '\uD83E\uDD14',
            '\uD83D\uDE22', '\uD83D\uDE31', '\uD83D\uDE44', '\uD83E\uDD73', '\uD83D\uDE0E',
            '\uD83D\uDC4D', '\uD83D\uDC4E', '\uD83D\uDC4F', '\uD83D\uDE4F', '\uD83D\uDCAA',
            '\u2764\uFE0F', '\uD83D\uDD25', '\uD83C\uDF89', '\u2705', '\u274C',
            '\uD83D\uDCA1', '\uD83D\uDCDD', '\uD83D\uDCBC', '\uD83D\uDE80', '\u2B50',
          ].map((emoji) => (
            <Pressable
              key={emoji}
              style={styles.emojiButton}
              onPress={() => {
                setText((prev) => prev + emoji)
                setShowEmojiPicker(false)
                textInputRef.current?.focus()
              }}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Input row */}
      <View style={[styles.inputRow, { backgroundColor: colors.bgTertiary, borderColor: colors.border }]}>
        {/* Attach button */}
        {onFileUpload && (
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            onPress={handlePickImage}
          >
            <Paperclip size={20} color="#94a3b8" />
          </Pressable>
        )}

        {/* Emoji button */}
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          onPress={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile size={20} color={showEmojiPicker ? colors.accent : colors.textMuted} />
        </Pressable>

        {/* TextInput */}
        <TextInput
          ref={textInputRef}
          value={text}
          onChangeText={handleTextChange}
          placeholder={placeholder || t('conversation.typeMessage')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
          editable={!disabled}
          style={[styles.textInput, { color: colors.text, height: Math.max(40, Math.min(inputHeight, 96)) }]}
          onContentSizeChange={(e) => {
            setInputHeight(e.nativeEvent.contentSize.height)
          }}
          textAlignVertical="center"
        />

        {/* Send or Mic button */}
        {(text.trim() || pendingFiles.length > 0) ? (
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: colors.accent },
              hasUploading && { backgroundColor: colors.accent + '80' },
              pressed && { backgroundColor: colors.accentHover },
            ]}
            onPress={handleSubmit}
            disabled={disabled || hasUploading}
          >
            {hasUploading ? (
              <Loader2 size={18} color="#ffffff" />
            ) : (
              <Send size={18} color="#ffffff" />
            )}
          </Pressable>
        ) : onAudioSend ? (
          isRecording ? (
            <View style={styles.recordingRow}>
              <Text style={styles.recordingTimer}>{recordingDuration}s</Text>
              <Pressable
                style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
                onPress={cancelRecording}
              >
                <X size={18} color="#ef4444" />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
                onPress={stopRecording}
              >
                <MicOff size={18} color="#ffffff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              onPress={startRecording}
              disabled={disabled}
            >
              <Mic size={20} color="#94a3b8" />
            </Pressable>
          )
        ) : (
          <View style={[styles.sendButton, styles.sendButtonDisabled]}>
            <Send size={18} color="#ffffff80" />
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  observerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  observerText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  mentionPopover: {
    maxHeight: 200,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mentionItemActive: {
    backgroundColor: '#6366f11A',
  },
  mentionInfo: {
    flex: 1,
    minWidth: 0,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  mentionHandle: {
    fontSize: 10,
    color: '#94a3b8',
  },
  mentionBadge: {
    color: '#a78bfa',
    backgroundColor: '#a78bfa26',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderLeftWidth: 2,
    borderLeftColor: '#6366f1',
  },
  replyContent: {
    flex: 1,
    minWidth: 0,
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6366f1',
  },
  replyPreview: {
    fontSize: 11,
    color: '#94a3b8',
  },
  replyCancelButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  fileChipUploaded: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  fileChipFailed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  fileChipNameFailed: {
    color: '#ef4444',
  },
  fileChipName: {
    fontSize: 12,
    color: '#64748b',
    maxWidth: 100,
  },
  fileChipSize: {
    fontSize: 10,
    color: '#94a3b8',
  },
  fileChipError: {
    fontSize: 10,
    color: '#ef4444',
  },
  mentionBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  mentionBadgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#6366f11A',
  },
  mentionBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6366f1',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingHorizontal: 4,
    paddingVertical: 8,
    maxHeight: 96,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#6366f180',
  },
  sendButtonPressed: {
    backgroundColor: '#4f46e5',
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordingTimer: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
    minWidth: 28,
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    gap: 2,
  },
  emojiButton: {
    width: '20%' as any,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  emojiText: {
    fontSize: 22,
  },
})
