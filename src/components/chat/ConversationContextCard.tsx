import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Brain, ChevronRight, ListTodo, MessagesSquare, TerminalSquare } from 'lucide-react-native'
import * as api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { useThemeColors } from '../../lib/theme'
import type { ConversationMemory, Task } from '../../lib/types'

interface Props {
  conversationId: number
  prompt?: string
  messageCount: number
  onOpenSettings?: () => void
  onOpenTasks?: () => void
}

function truncate(text: string, max = 120) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

export function ConversationContextCard({ conversationId, prompt = '', messageCount, onOpenSettings, onOpenTasks }: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const token = useAuthStore((s) => s.token)
  const [resolvedPrompt, setResolvedPrompt] = useState(prompt)
  const [memoryCount, setMemoryCount] = useState(0)
  const [recentMemories, setRecentMemories] = useState<ConversationMemory[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    setResolvedPrompt(prompt)
  }, [prompt])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api.listMemories(token, conversationId).then((res) => {
      if (cancelled || !res.ok || !res.data) return
      setResolvedPrompt(res.data.prompt || '')
      const nextMemories = res.data.memories || []
      setMemoryCount(nextMemories.length)
      setRecentMemories(nextMemories.slice(0, 2))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [token, conversationId])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api.listTasks(token, conversationId).then((res) => {
      if (cancelled || !res.ok || !res.data) return
      setTasks(res.data || [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [token, conversationId])

  const promptPreview = useMemo(() => truncate(resolvedPrompt), [resolvedPrompt])
  const hasContext = !!promptPreview || memoryCount > 0
  const openTaskCount = useMemo(() => tasks.filter((task) => task.status !== 'done').length, [tasks])
  const doneTaskCount = useMemo(() => tasks.filter((task) => task.status === 'done').length, [tasks])
  const canOpen = !!onOpenSettings || !!onOpenTasks

  if (!hasContext && tasks.length === 0) return null

  return (
    <Pressable
      onPress={onOpenSettings || onOpenTasks}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.bgSecondary,
          borderColor: colors.border,
        },
        pressed && canOpen && { backgroundColor: colors.bgHover },
      ]}
      disabled={!canOpen}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Brain size={14} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]}>{t('memory.contextTitle')}</Text>
        </View>
        {canOpen ? <ChevronRight size={14} color={colors.textMuted} /> : null}
      </View>

      {promptPreview ? (
        <View style={styles.row}>
          <View style={[styles.iconChip, { backgroundColor: colors.accentDim }]}>
            <TerminalSquare size={12} color={colors.accent} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('memory.contextPrompt')}</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]} numberOfLines={2}>{promptPreview}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={[styles.iconChip, { backgroundColor: colors.bgHover }]}>
          <MessagesSquare size={12} color={colors.textSecondary} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('memory.contextMemories')}</Text>
          <Text style={[styles.value, { color: colors.textSecondary }]}>
            {t('memory.contextSummary', { count: memoryCount, messages: messageCount })}
          </Text>
          {recentMemories.map((memory) => (
            <Text key={memory.id} style={[styles.detailText, { color: colors.textMuted }]} numberOfLines={2}>
              <Text style={[styles.detailStrong, { color: colors.textSecondary }]}>{memory.key}</Text>: {truncate(memory.content, 68)}
            </Text>
          ))}
        </View>
      </View>

      {tasks.length > 0 && (
        <View style={styles.row}>
          <View style={[styles.iconChip, { backgroundColor: colors.bgHover }]}>
            <ListTodo size={12} color={colors.textSecondary} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('memory.contextTasks')}</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              {t('memory.contextTaskSummary', { open: openTaskCount, done: doneTaskCount })}
            </Text>
            {tasks[0]?.title ? (
              <Text style={[styles.detailText, { color: colors.textMuted }]} numberOfLines={2}>
                <Text style={[styles.detailStrong, { color: colors.textSecondary }]}>{t('memory.contextTopTask')}</Text>: {tasks[0].title}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 12,
    lineHeight: 18,
  },
  detailText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  detailStrong: {
    fontWeight: '600',
  },
})
