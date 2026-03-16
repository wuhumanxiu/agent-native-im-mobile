import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { usePresenceStore } from '../../store/presence'

export function ConnectionStatusBar() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const wsConnected = usePresenceStore((s) => s.wsConnected)
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasDisconnected, setWasDisconnected] = useState(false)

  useEffect(() => {
    if (wsConnected && wasDisconnected) {
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 2500)
      return () => clearTimeout(timer)
    }
    if (!wsConnected) {
      setWasDisconnected(true)
    }
  }, [wsConnected, wasDisconnected])

  if (wsConnected && !showReconnected) return null

  const isOk = wsConnected && showReconnected
  const bgColor = isOk ? colors.success + '20' : colors.warning + '20'
  const textColor = isOk ? colors.success : colors.warning

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.dot, { backgroundColor: textColor }]} />
      <Text style={[styles.text, { color: textColor }]}>
        {isOk ? t('connection.reconnected') : t('connection.disconnected')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
})
