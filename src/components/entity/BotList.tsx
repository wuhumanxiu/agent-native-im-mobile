import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Bot, Plus, Search, PowerOff } from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { Entity } from '../../lib/types'
import { EntityAvatar } from '../ui/EntityAvatar'
import { useThemeColors } from '../../lib/theme'

interface Props {
  selectedId: number | null
  onSelect: (id: number) => void
  onCreatePress: () => void
  onCreated?: (result: { entity: Entity; key: string; doc: string }) => void
  refreshTrigger?: number
}

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

export function BotList({ selectedId, onSelect, onCreatePress, refreshTrigger }: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const token = useAuthStore((s) => s.token)!
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlineSet, setOnlineSet] = useState<Set<number>>(new Set())

  const fetchPresence = useCallback(async (list: Entity[]) => {
    const botIds = list.filter((e) => e.entity_type !== 'user').map((e) => e.id)
    if (botIds.length > 0) {
      const presRes = await api.batchPresence(token, botIds)
      if (presRes.ok && presRes.data?.presence) {
        const next = new Set<number>()
        for (const [idStr, isOn] of Object.entries(presRes.data.presence)) {
          if (isOn) next.add(Number(idStr))
        }
        setOnlineSet(next)
      }
    }
  }, [token])

  const loadEntities = useCallback(async () => {
    try {
      const res = await api.listEntities(token)
      const list = res.ok && res.data ? (Array.isArray(res.data) ? res.data : []) : []
      setEntities(list)
      await fetchPresence(list)
    } catch {
      // Network failed
    } finally {
      setLoading(false)
    }
  }, [token, fetchPresence])

  useEffect(() => {
    setLoading(true)
    loadEntities()
  }, [loadEntities, refreshTrigger])

  const bots = entities.filter((e) => e.entity_type !== 'user')
  const filtered = search
    ? bots.filter((e) =>
        e.display_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.name?.toLowerCase().includes(search.toLowerCase())
      )
    : bots

  const activeBots = filtered
    .filter((e) => e.status !== 'disabled')
    .sort((a, b) => (onlineSet.has(a.id) ? 0 : 1) - (onlineSet.has(b.id) ? 0 : 1))
  const disabledBots = filtered.filter((e) => e.status === 'disabled')
  const allBots = [...activeBots, ...disabledBots]

  const renderBotItem = ({ item: entity }: { item: Entity }) => {
    const isOnline = onlineSet.has(entity.id)
    const isDisabled = entity.status === 'disabled'
    const isActive = entity.id === selectedId
    const meta = entity.metadata as Record<string, unknown> | undefined
    const tags = Array.isArray(meta?.tags) ? (meta.tags as string[]) : []
    const description = (meta?.description as string) || ''

    return (
      <Pressable
        onPress={() => onSelect(entity.id)}
        style={({ pressed }) => [
          styles.botCard,
          { borderColor: colors.border },
          isActive && { borderColor: colors.accent, backgroundColor: colors.accentDim },
          isDisabled && styles.botCardDisabled,
          pressed && { backgroundColor: colors.bgHover },
        ]}
      >
        <View style={styles.avatarContainer}>
          <EntityAvatar entity={entity} size="md" showStatus isOnline={isOnline} />
        </View>
        <View style={styles.botInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.botName, { color: colors.text }]} numberOfLines={1}>
              {entityDisplayName(entity)}
            </Text>
            <View style={[
              styles.statusBadge,
              isDisabled ? styles.statusWarning : isOnline ? styles.statusOnline : styles.statusOffline,
            ]}>
              <Text style={[
                styles.statusText,
                isDisabled ? styles.statusTextWarning : isOnline ? styles.statusTextOnline : styles.statusTextOffline,
              ]}>
                {isDisabled ? t('bot.disabled') : isOnline ? t('common.online') : t('common.offline')}
              </Text>
            </View>
          </View>
          {description ? (
            <Text style={styles.botDescription} numberOfLines={1}>{description}</Text>
          ) : null}
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.slice(0, 3).map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {tags.length > 3 && (
                <Text style={styles.tagMore}>+{tags.length - 3}</Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
    )
  }

  const renderSeparator = () => {
    if (activeBots.length > 0 && disabledBots.length > 0) {
      const lastActiveIdx = activeBots.length - 1
      return null // handled in ListHeaderComponent area
    }
    return null
  }

  const renderDisabledHeader = () => {
    if (disabledBots.length === 0 || activeBots.length === 0) return null
    return (
      <View style={styles.disabledHeader}>
        <View style={styles.dividerLine} />
        <View style={styles.disabledLabel}>
          <PowerOff size={10} color="#94a3b8" />
          <Text style={styles.disabledLabelText}>
            {t('bot.disabledSection')} ({disabledBots.length})
          </Text>
        </View>
        <View style={styles.dividerLine} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Bot size={18} color={colors.accent} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('bot.agents')}</Text>
          <Text style={[styles.headerCount, { color: colors.textMuted }]}>({activeBots.length})</Text>
        </View>
        <Pressable onPress={onCreatePress} style={styles.addButton}>
          <Plus size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchRow, { backgroundColor: colors.bgTertiary }]}>
          <Search size={14} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('bot.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      {/* Bot list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#6366f1" />
        </View>
      ) : allBots.length === 0 ? (
        <View style={styles.centered}>
          <Bot size={32} color="#94a3b8" />
          <Text style={styles.emptyText}>
            {search ? t('common.noMatches') : t('bot.noAgents')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={allBots}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBotItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => {
            // Show disabled header between active and disabled sections
            const idx = activeBots.length
            return null
          }}
          ListHeaderComponent={null}
          // We manually insert the separator by checking if item is first disabled bot
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerCount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 32,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  botCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    gap: 12,
  },
  botCardActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  botCardDisabled: {
    opacity: 0.5,
  },
  botCardPressed: {
    backgroundColor: '#f1f5f9',
  },
  avatarContainer: {
    flexShrink: 0,
  },
  botInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  botName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusOnline: {
    backgroundColor: '#dcfce7',
  },
  statusOffline: {
    backgroundColor: '#f1f5f9',
  },
  statusWarning: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '500',
  },
  statusTextOnline: {
    color: '#16a34a',
  },
  statusTextOffline: {
    color: '#94a3b8',
  },
  statusTextWarning: {
    color: '#d97706',
  },
  botDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
  },
  tagText: {
    fontSize: 9,
    color: '#6366f1',
  },
  tagMore: {
    fontSize: 9,
    color: '#94a3b8',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  disabledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginTop: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  disabledLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disabledLabelText: {
    fontSize: 10,
    color: '#94a3b8',
  },
})
