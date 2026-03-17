import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, FlatList, Pressable, ActivityIndicator,
  Modal, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Search, X, MessageSquare } from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { GlobalSearchResult } from '../../lib/types'

interface Props {
  visible: boolean
  onSelectResult: (conversationId: number, messageId: number) => void
  onClose: () => void
}

function entityDisplayName(entity?: { display_name?: string; name?: string } | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

function getSnippet(result: GlobalSearchResult): string {
  const summary = result.layers?.summary || ''
  const body = (result.layers?.data as Record<string, unknown>)?.body as string | undefined
  return summary || body || ''
}

function formatTime(dateStr: string, t: (key: string) => string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) {
    return t('app.yesterday')
  }
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function GlobalSearch({ visible, onSelectResult, onClose }: Props) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)!
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inputRef = useRef<TextInput>(null)
  const PAGE_SIZE = 20

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setResults([])
      setHasSearched(false)
      setOffset(0)
      setHasMore(false)
    }
  }, [visible])

  const doSearch = useCallback(async (q: string, newOffset: number, append: boolean) => {
    if (q.length < 2) {
      if (!append) {
        setResults([])
        setHasSearched(false)
      }
      return
    }
    setLoading(true)
    try {
      const res = await api.searchGlobal(token, q, PAGE_SIZE, newOffset)
      if (res.ok && res.data) {
        const msgs = res.data.messages || []
        setResults((prev) => append ? [...prev, ...msgs] : msgs)
        setHasMore(msgs.length === PAGE_SIZE)
        setOffset(newOffset + msgs.length)
      }
      setHasSearched(true)
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    setOffset(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(value, 0, false)
    }, 300)
  }, [doSearch])

  const handleLoadMore = useCallback(() => {
    doSearch(query, offset, true)
  }, [doSearch, query, offset])

  const renderResult = ({ item: result }: { item: GlobalSearchResult }) => {
    const snippet = getSnippet(result)
    const senderName = entityDisplayName(result.sender)
    return (
      <Pressable
        onPress={() => onSelectResult(result.conversation_id, result.id)}
        style={({ pressed }) => [styles.resultItem, pressed && styles.resultItemPressed]}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.resultConvTitle} numberOfLines={1}>
            {result.conversation_title || t('conversation.unnamed')}
          </Text>
          <Text style={styles.resultTime}>
            {formatTime(result.created_at, t)}
          </Text>
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.resultSender}>{senderName}:</Text>
          <Text style={styles.resultSnippet} numberOfLines={2}>
            {snippet.slice(0, 120)}
            {snippet.length > 120 ? '...' : ''}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Search input */}
        <View style={styles.searchBar}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={handleInputChange}
            placeholder={t('conversation.globalSearch')}
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {loading && <ActivityIndicator size="small" color="#6366f1" />}
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={14} color="#94a3b8" />
          </Pressable>
        </View>

        {/* Results */}
        {query.length > 0 && query.length < 2 && (
          <View style={styles.centered}>
            <Text style={styles.hintText}>{t('conversation.minQueryLength')}</Text>
          </View>
        )}

        {hasSearched && results.length === 0 && !loading && (
          <View style={styles.centered}>
            <MessageSquare size={32} color="#94a3b8" />
            <Text style={styles.emptyText}>{t('conversation.noResults')}</Text>
          </View>
        )}

        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderResult}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              hasMore && !loading ? (
                <Pressable onPress={handleLoadMore} style={styles.loadMoreBtn}>
                  <Text style={styles.loadMoreText}>{t('conversation.loadMore')}</Text>
                </Pressable>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    padding: 0,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  hintText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultItemPressed: {
    backgroundColor: '#f8fafc',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultConvTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366f1',
    maxWidth: '70%',
  },
  resultTime: {
    fontSize: 10,
    color: '#94a3b8',
    flexShrink: 0,
  },
  resultBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  resultSender: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    flexShrink: 0,
  },
  resultSnippet: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 12,
    color: '#6366f1',
  },
})
