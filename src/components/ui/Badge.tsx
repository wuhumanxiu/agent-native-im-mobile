import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'

interface BadgeProps {
  count: number
  maxCount?: number
}

export function Badge({ count, maxCount = 99 }: BadgeProps) {
  const { colors } = useTheme()

  if (count <= 0) return null

  const display = count > maxCount ? `${maxCount}+` : String(count)
  const isWide = display.length > 1

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: colors.accent,
        minWidth: 20,
        paddingHorizontal: isWide ? 6 : 0,
      },
    ]}>
      <Text style={styles.text}>{display}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 20,
  },
})
