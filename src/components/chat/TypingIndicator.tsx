import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'

interface Props {
  typingEntities?: Map<number, { name: string; expiresAt: number; isProcessing?: boolean; phase?: string }>
}

export function TypingIndicator({ typingEntities }: Props) {
  const { t } = useTranslation()
  const { colors } = useTheme()

  if (!typingEntities || typingEntities.size === 0) return null

  const now = Date.now()
  const active = Array.from(typingEntities.values()).filter((e) => e.expiresAt > now)
  if (active.length === 0) return null

  let label: string
  if (active.length === 1) {
    label = t('message.isTyping', { name: active[0].name })
  } else {
    const names = active.map((e) => e.name).join(', ')
    label = t('message.areTyping', { names })
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <View style={styles.dots}>
        <View style={[styles.dot, { backgroundColor: colors.accent, opacity: 0.4 }]} />
        <View style={[styles.dot, { backgroundColor: colors.accent, opacity: 0.6 }]} />
        <View style={[styles.dot, { backgroundColor: colors.accent, opacity: 0.9 }]} />
      </View>
      <Text style={[styles.text, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  text: {
    fontSize: 12,
    flex: 1,
  },
})
