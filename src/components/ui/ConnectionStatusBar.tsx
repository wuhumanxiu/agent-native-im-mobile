import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Wifi, WifiOff } from 'lucide-react-native'
import { useThemeColors } from '../../lib/theme'

interface Props {
  connected: boolean
  outboxCount?: number
  outboxFailedCount?: number
  onRetryNow?: () => void
}

export function ConnectionStatusBar({
  connected,
  outboxCount = 0,
  outboxFailedCount = 0,
  onRetryNow,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const [showReconnected, setShowReconnected] = useState(false)
  const wasDisconnected = useRef(false)

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    if (connected && wasDisconnected.current) {
      setShowReconnected(true)
      hideTimer = setTimeout(() => setShowReconnected(false), 2000)
    }

    wasDisconnected.current = !connected

    return () => {
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [connected])

  if (!connected) {
    return (
      <View style={styles.wrapper} pointerEvents="box-none">
        <View style={[styles.pill, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
          <WifiOff size={14} color={colors.warning} />
          <Text style={[styles.text, { color: colors.warning }]}>
            {t('connection.disconnected')}
          </Text>
          {outboxCount > 0 ? (
            <Text style={[styles.metaText, { color: colors.warning }]}>
              {t('connection.queuedMessages', { count: outboxCount })}
            </Text>
          ) : null}
          {outboxFailedCount > 0 ? (
            <Text style={[styles.metaText, { color: colors.warning }]}>
              {t('connection.failedMessages', { count: outboxFailedCount })}
            </Text>
          ) : null}
          {onRetryNow && outboxCount > 0 ? (
            <Pressable onPress={onRetryNow} style={[styles.retryButton, { backgroundColor: 'rgba(217,119,6,0.12)' }]}>
              <Text style={[styles.retryText, { color: colors.warning }]}>
                {t('connection.retryNow')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  if (!showReconnected) return null

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={[styles.pill, { backgroundColor: 'rgba(34, 197, 94, 0.14)' }]}>
        <Wifi size={14} color={colors.success} />
        <Text style={[styles.text, { color: colors.success }]}>
          {t('connection.reconnected')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
    opacity: 0.9,
  },
  retryButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '600',
  },
})
