import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Search, Plus, MessageSquare, X } from 'lucide-react-native'
import { ConversationItem } from './ConversationItem'
import { SkeletonLoader } from '../ui/SkeletonLoader'
import { EmptyState } from '../ui/EmptyState'
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
  onToggleMute?: (id: number) => void
  onPin?: (id: number) => void
  onUnpin?: (id: number) => void
  onArchive?: (id: number) => void
  onLeave?: (id: number) => void
  onRefresh?: () => Promise<void>
  isMuted?: (id: number) => boolean
  loading?: boolean
  error?: string | null
}

export function ConversationList({
  conversations,
  activeId,
  myEntityId,
  onSelect,
  onNewChat,
  onToggleMute,
  onPin,
  onUnpin,
  onArchive,
  onLeave,
  onRefresh,
  isMuted,
  loading,
  error,
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
          <Pressable style={[styles.newChatButton, { backgroundColor: colors.accent }]} onPress={onNewChat}>
            <Text style={styles.newChatButtonText}>{t('conversation.newChat')}</Text>
          </Pressable>
        }
      />
    )
  }, [loading, conversations.length, search, t, onNewChat])

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('conversation.messages')}</Text>
        <Pressable
          style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.bgHover }]}
          onPress={onNewChat}
        >
          <Plus size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgTertiary }]}>
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
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
    paddingBottom: 16,
  },
  emptyContainer: {
    flexGrow: 1,
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
