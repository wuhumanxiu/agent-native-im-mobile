import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { useAuthStore } from '../../store/auth'
import { usePresenceStore } from '../../store/presence'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { entityDisplayName, formatTime } from '../../lib/utils'
import * as api from '../../lib/api'
import type { Entity } from '../../lib/types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type BotsStackParamList = {
  BotList: undefined
  BotDetail: { botId: number }
}

type Props = NativeStackScreenProps<BotsStackParamList, 'BotDetail'>

export function BotDetailScreen({ route, navigation }: Props) {
  const { botId } = route.params
  const { colors } = useTheme()
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const online = usePresenceStore((s) => s.online)

  const [bot, setBot] = useState<Entity | null>(null)
  const [loading, setLoading] = useState(true)
  const [credentials, setCredentials] = useState<{ has_bootstrap: boolean; has_api_key: boolean; bootstrap_prefix: string } | null>(null)

  const loadBot = useCallback(async () => {
    if (!token) return
    const res = await api.listEntities(token)
    if (res.ok && res.data) {
      const found = (res.data as Entity[]).find((e) => e.id === botId)
      setBot(found || null)
    }
    const credRes = await api.getEntityCredentials(token, botId)
    if (credRes.ok && credRes.data) {
      setCredentials(credRes.data)
    }
    setLoading(false)
  }, [token, botId])

  useEffect(() => {
    loadBot()
  }, [loadBot])

  const handleRegenerate = useCallback(async () => {
    if (!token) return
    Alert.alert('Regenerate Token', 'This will revoke existing API keys and disconnect sessions.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        style: 'destructive',
        onPress: async () => {
          const res = await api.regenerateEntityToken(token, botId)
          if (res.ok && res.data) {
            Alert.alert('New API Key', res.data.api_key, [
              {
                text: 'Copy',
                onPress: () => Clipboard.setStringAsync(res.data!.api_key),
              },
              { text: 'OK' },
            ])
            loadBot()
          }
        },
      },
    ])
  }, [token, botId, loadBot])

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!bot) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textMuted }}>Bot not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isOnline = online.has(bot.id)

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <Text style={[styles.backArrow, { color: colors.accent }]}>{'<'}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('bot.agentDetails')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + Name */}
        <View style={styles.profileSection}>
          <EntityAvatar entity={bot} size="lg" showOnline />
          <Text style={[styles.botName, { color: colors.textPrimary }]}>
            {entityDisplayName(bot)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: isOnline ? colors.success + '20' : colors.bgTertiary }]}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.textMuted }]} />
            <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.textMuted }]}>
              {isOnline ? t('bot.statusActive') : t('bot.statusOffline')}
            </Text>
          </View>
        </View>

        {/* Info rows */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <InfoRow label={t('bot.type')} value={bot.entity_type} colors={colors} />
          <InfoRow label={t('bot.id')} value={String(bot.id)} colors={colors} />
          <InfoRow label={t('bot.status')} value={bot.status} colors={colors} />
          <InfoRow label={t('bot.createdAt')} value={formatTime(bot.created_at)} colors={colors} />
          {credentials && (
            <>
              <InfoRow label="API Key" value={credentials.has_api_key ? 'Configured' : 'Missing'} colors={colors} />
              <InfoRow label="Bootstrap" value={credentials.has_bootstrap ? 'Present' : 'N/A'} colors={colors} />
            </>
          )}
        </View>

        {/* Actions */}
        <Pressable
          onPress={handleRegenerate}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.actionButtonText}>Regenerate Token</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: { textMuted: string; textPrimary: string; border: string } }) {
  return (
    <View style={[infoStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[infoStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
})

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  botName: {
    fontSize: 22,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 20,
  },
  actionButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
})
