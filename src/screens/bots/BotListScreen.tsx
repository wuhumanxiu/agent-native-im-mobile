import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, TextInput, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { useAuthStore } from '../../store/auth'
import { usePresenceStore } from '../../store/presence'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { entityDisplayName, formatTime } from '../../lib/utils'
import * as api from '../../lib/api'
import type { Entity } from '../../lib/types'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void }
}

export function BotListScreen({ navigation }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const online = usePresenceStore((s) => s.online)

  const [bots, setBots] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [newBotName, setNewBotName] = useState('')
  const [creating, setCreating] = useState(false)

  const loadBots = useCallback(async () => {
    if (!token) return
    const res = await api.listEntities(token)
    if (res.ok && res.data) {
      setBots(Array.isArray(res.data) ? res.data : [])
    }
  }, [token])

  useEffect(() => {
    setLoading(true)
    loadBots().finally(() => setLoading(false))
  }, [loadBots])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadBots()
    setRefreshing(false)
  }, [loadBots])

  const handleCreate = useCallback(async () => {
    if (!token || !newBotName.trim()) return
    setCreating(true)
    const res = await api.createEntity(token, newBotName.trim())
    if (res.ok && res.data) {
      setNewBotName('')
      await loadBots()
      Alert.alert(res.data.entity.name, t('bot.created'))
    }
    setCreating(false)
  }, [token, newBotName, loadBots, t])

  const ownedBots = bots.filter((b) => b.owner_id === entity?.id)

  const renderItem = useCallback(({ item }: { item: Entity }) => {
    const isOnline = online.has(item.id)
    return (
      <Pressable
        onPress={() => navigation.navigate('BotDetail', { botId: item.id })}
        style={({ pressed }) => [
          styles.botItem,
          { backgroundColor: pressed ? colors.bgTertiary : 'transparent' },
        ]}
      >
        <EntityAvatar entity={item} size="md" showOnline />
        <View style={styles.botInfo}>
          <Text style={[styles.botName, { color: colors.textPrimary }]}>
            {entityDisplayName(item)}
          </Text>
          <Text style={[styles.botMeta, { color: isOnline ? colors.success : colors.textMuted }]}>
            {isOnline ? t('bot.statusActive') : t('bot.statusOffline')} {' '} ID: {item.id}
          </Text>
        </View>
      </Pressable>
    )
  }, [colors, online, t, navigation])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('bot.agents')}
        </Text>
      </View>

      {/* Create new agent */}
      <View style={[styles.createRow, { backgroundColor: colors.bgSecondary }]}>
        <TextInput
          value={newBotName}
          onChangeText={setNewBotName}
          placeholder={t('bot.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={[styles.createInput, { color: colors.textPrimary, backgroundColor: colors.bgTertiary }]}
          editable={!creating}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <Pressable
          onPress={handleCreate}
          disabled={creating || !newBotName.trim()}
          style={({ pressed }) => [
            styles.createBtn,
            {
              backgroundColor: colors.accent,
              opacity: pressed || creating || !newBotName.trim() ? 0.5 : 1,
            },
          ]}
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.createBtnText}>+</Text>
          )}
        </Pressable>
      </View>

      {/* Bot list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={ownedBots}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('bot.noAgents')}
              </Text>
            </View>
          }
          contentContainerStyle={ownedBots.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  createInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  createBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  botItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  botInfo: {
    flex: 1,
  },
  botName: {
    fontSize: 15,
    fontWeight: '600',
  },
  botMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  emptyList: {
    flexGrow: 1,
  },
})
