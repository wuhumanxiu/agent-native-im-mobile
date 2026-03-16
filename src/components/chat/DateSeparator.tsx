import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'

interface Props {
  label: string
}

export function DateSeparator({ label }: Props) {
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 10,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
})
