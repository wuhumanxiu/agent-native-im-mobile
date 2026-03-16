import React, { useState, useRef, useCallback } from 'react'
import { View, TextInput, Pressable, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../theme/ThemeContext'
import { useTranslation } from 'react-i18next'

interface MessageComposerProps {
  onSend: (text: string) => void
  onAttach?: (file: { uri: string; name: string; type: string }) => void
  onTyping?: () => void
  disabled?: boolean
}

export function MessageComposer({ onSend, onAttach, onTyping, disabled = false }: MessageComposerProps) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)
  const lastTypingRef = useRef(0)

  const handleChangeText = useCallback((value: string) => {
    setText(value)
    const now = Date.now()
    if (now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now
      onTyping?.()
    }
  }, [onTyping])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSend(trimmed)
    setText('')
  }, [text, onSend])

  const handleAttach = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0]
        onAttach?.({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        })
      }
    } catch {}
  }, [onAttach])

  const handleImagePick = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      })

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0]
        const filename = asset.uri.split('/').pop() || 'image.jpg'
        onAttach?.({
          uri: asset.uri,
          name: filename,
          type: asset.mimeType || 'image/jpeg',
        })
      }
    } catch {}
  }, [onAttach])

  const showSend = text.trim().length > 0

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.container, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border }]}>
        {/* Attach button */}
        <Pressable
          onPress={handleAttach}
          onLongPress={handleImagePick}
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
        >
          <AttachIcon color={colors.textMuted} />
        </Pressable>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={handleChangeText}
          placeholder={t('conversation.typeMessage')}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.bgTertiary,
              borderColor: colors.borderSubtle,
            },
          ]}
          multiline
          maxLength={4000}
          editable={!disabled}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Send button */}
        {showSend && (
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: colors.accent,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            hitSlop={8}
          >
            <SendIcon color="#ffffff" />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

// Simple SVG-like icons as Text components
function AttachIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 12,
        height: 18,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 6,
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  )
}

function SendIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderTopWidth: 6,
        borderBottomWidth: 6,
        borderLeftColor: color,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        marginLeft: 3,
      }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
