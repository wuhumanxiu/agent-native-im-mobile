import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Search, Plus, MessageSquare, X } from 'lucide-react-native'
import { ConversationItem } from './ConversationItem'
import { SkeletonLoader } from '../ui/SkeletonLoader'
import { EmptyState } from '../ui/EmptyState'
import { OnboardingCard } from '../ui/OnboardingCard'
import { useThemeColors } from '../../lib/theme'
import type { Conversation } from '../../lib/types'

// ─── Utility ─────────────────────────────────────────────────────

function entityDisplayName(entity?: { display_name?: string; name?: string } | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name || 'Unknown'
}

// ─── Props ───────────────────────────────────────────────────────

interface Props {
  conversations: Conversation[]
  activeId: number | null
  myEntityId: number
  onSelect: (id: number) => void
  onNewChat: () => void
  onManageBots?: () => void
  onToggleMute?: (id: number) => void
  onPin?: (id: number) => void
  onUnpin?: (id: number) => void
  onArchive?: (id: number) => void
  onLeave?: (id: number) => void
  onRefresh?: () => Promise<void>
  isMuted?: (id: number) => boolean
  loading?: boolean
  error?: string | null
  showCachedSnapshot?: boolean
}

export function ConversationList({
  conversations,
  activeId,
  myEntityId,
  onSelect,
  onNewChat,
  onManageBots,
  onToggleMute,
  onPin,
  onUnpin,
  onArchive,
  onLeave,
  onRefresh,
  isMuted,
  loading,
  error,
  showCachedSnapshot = false,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Sort: pinned first, then by last message time
  const sorted = useMemo(() => {
    if (!Array.isArray(conversations)) return []
    return [...conversations].sort((a, b) => {
      const pinnedA = a.participants?.find((p) => p.entity_id === myEntityId)?.pinned_at
      const pinnedB = b.participants?.find((p) => p.entity_id === myEntityId)?.pinned_at
      if (pinnedA && !pinnedB) return -1
      if (!pinnedA && pinnedB) return 1
      const timeA = a.last_message?.created_at || a.updated_at || a.created_at
      const timeB = b.last_message?.created_at || b.updated_at || b.created_at
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })
  }, [conversations, myEntityId])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter((c) =>
      c.title?.toLowerCase().includes(q) ||
      c.participants?.some((p) =>
        entityDisplayName(p.entity).toLowerCase().includes(q)
      )
    )
  }, [sorted, search])

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      conv={item}
      active={item.id === activeId}
      myEntityId={myEntityId}
      isMuted={isMuted?.(item.id)}
      onPress={() => onSelect(item.id)}
      onToggleMute={onToggleMute}
      onPin={onPin}
      onUnpin={onUnpin}
      onArchive={onArchive}
      onLeave={onLeave}
    />
  ), [activeId, myEntityId, isMuted, onSelect, onToggleMute, onPin, onUnpin, onArchive, onLeave])

  const keyExtractor = useCallback((item: Conversation) => String(item.id), [])

  // Empty state
  const renderEmpty = useCallback(() => {
    if (loading && conversations.length === 0) {
      return <SkeletonLoader variant="conversation-list" />
    }
    if (search) {
      return (
        <EmptyState
          icon={<Search size={28} color="#94a3b8" />}
          title={t('conversation.noMatches')}
        />
      )
    }
    return (
      <EmptyState
        icon={<MessageSquare size={28} color="#94a3b8" />}
        title={error ? t('common.error') : t('conversation.noConversations')}
        description={error || t('conversation.noConversationsDesc')}
        action={
          <View style={styles.onboardingWrap}>
            <OnboardingCard onNewChat={onNewChat} onManageBots={onManageBots} />
          </View>
        }
      />
    )
  }, [loading, conversations.length, search, t, onNewChat, onManageBots, error])

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerEyebrow, { color: colors.textMuted }]}>{t('conversation.messages')}</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('conversation.messages')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.headerButton,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
            },
            pressed && { backgroundColor: colors.bgHover },
          ]}
          onPress={onNewChat}
        >
          <Plus size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('conversation.search')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.searchClear}>
              <X size={14} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        {showCachedSnapshot ? (
          <View style={[styles.cachedBanner, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.cachedBannerText, { color: colors.textMuted }]}>
              {t('conversation.cachedSnapshot')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* List */}
      {loading && conversations.length === 0 ? (
        <SkeletonLoader variant="conversation-list" />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  cachedBanner: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cachedBannerText: {
    fontSize: 11,
    lineHeight: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
    padding: 0,
  },
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e2e8f080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 2,
    paddingBottom: 22,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  onboardingWrap: {
    width: '100%',
    maxWidth: 360,
  },
  separator: {
    height: 2,
  },
  newChatButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#6366f1',
  },
  newChatButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
})
