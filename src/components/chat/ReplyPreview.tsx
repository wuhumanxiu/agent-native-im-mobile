import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { entityDisplayName, truncate } from '../../lib/utils'
import type { Message } from '../../lib/types'

interface Props {
  message: Message
  onClear: () => void
}

export function ReplyPreview({ message, onClear }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()

  const senderName = entityDisplayName(message.sender)
  const text = (message.layers?.data?.body as string) || message.layers?.summary || ''

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border }]}>
      <View style={[styles.bar, { backgroundColor: colors.accent }]} />
      <View style={styles.content}>
        <Text style={[styles.senderName, { color: colors.accent }]} numberOfLines={1}>
          {t('message.replyTo', { name: senderName })}
        </Text>
        <Text style={[styles.previewText, { color: colors.textMuted }]} numberOfLines={1}>
          {truncate(text, 80)}
        </Text>
      </View>
      <Pressable onPress={onClear} hitSlop={12} style={styles.closeBtn}>
        <Text style={[styles.closeText, { color: colors.textMuted }]}>X</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  bar: {
    width: 3,
    height: 32,
    borderRadius: 1.5,
  },
  content: {
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  previewText: {
    fontSize: 13,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
  },
})
