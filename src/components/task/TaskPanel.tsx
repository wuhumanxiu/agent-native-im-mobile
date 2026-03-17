import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, Alert,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Plus, Check, Clock, Trash2, Calendar, ArrowLeft, X,
} from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { Task, TaskStatus, TaskPriority } from '../../lib/types'
import { EntityAvatar } from '../ui/EntityAvatar'

interface Props {
  conversationId: number
  participants: { entity_id: number; entity?: { id: number; display_name: string; name: string; entity_type: string } }[]
  onClose: () => void
  isArchived?: boolean
}

function entityDisplayName(entity?: { display_name?: string; name?: string } | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

const priorityColors: Record<TaskPriority, string> = {
  low: '#94a3b8',
  medium: '#eab308',
  high: '#ef4444',
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

export function TaskPanel({ conversationId, participants, onClose, isArchived }: Props) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)!

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assigneeId, setAssigneeId] = useState<number | undefined>()
  const [creating, setCreating] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listTasks(token, conversationId)
      if (res.ok && res.data) {
        setTasks(Array.isArray(res.data) ? res.data : [])
      }
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [token, conversationId])

  useEffect(() => { loadTasks() }, [loadTasks])

  const handleCreate = async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const res = await api.createTask(token, conversationId, {
        title: title.trim(),
        priority,
        ...(description.trim() && { description: description.trim() }),
        ...(assigneeId && { assignee_id: assigneeId }),
      })
      if (res.ok && res.data) {
        setTasks((prev) => [res.data!, ...prev])
        setTitle('')
        setDescription('')
        setAssigneeId(undefined)
        setShowForm(false)
      }
    } catch {
      // silently fail
    }
    setCreating(false)
  }

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const res = await api.updateTask(token, task.id, { status })
      if (res.ok && res.data) {
        setTasks((prev) => prev.map((t) => t.id === task.id ? res.data! : t))
      }
    } catch {
      // silently fail
    }
  }

  const handleDelete = (task: Task) => {
    Alert.alert(
      t('task.deleteTitle'),
      t('task.deleteMessage', { title: task.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const res = await api.deleteTask(token, task.id)
            if (res.ok) {
              setTasks((prev) => prev.filter((t) => t.id !== task.id))
            }
          },
        },
      ]
    )
  }

  const grouped = {
    pending: tasks.filter((t) => t.status === 'pending'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    handed_over: tasks.filter((t) => t.status === 'handed_over'),
    done: tasks.filter((t) => t.status === 'done' || t.status === 'cancelled'),
  }

  const statusLabels: Record<string, string> = {
    pending: t('task.pending'),
    in_progress: t('task.inProgress'),
    handed_over: t('task.handedOver'),
    done: t('task.completed'),
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <ArrowLeft size={16} color="#64748b" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {t('task.title')}
            {isArchived && <Text style={styles.archivedLabel}> ({t('common.archived')})</Text>}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {!isArchived && (
            <Pressable onPress={() => setShowForm(!showForm)} style={styles.addBtn}>
              <Plus size={16} color="#6366f1" />
            </Pressable>
          )}
        </View>
      </View>

      {/* New task form */}
      {showForm && (
        <View style={styles.formContainer}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('task.newTaskPlaceholder')}
            placeholderTextColor="#94a3b8"
            style={styles.formInput}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('task.descriptionPlaceholder')}
            placeholderTextColor="#94a3b8"
            style={[styles.formInput, styles.formTextarea]}
            multiline
            numberOfLines={2}
          />
          <View style={styles.formOptionsRow}>
            {/* Priority selector */}
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.priorityBtn, priority === p && styles.priorityBtnActive]}
                >
                  <View style={[styles.priorityDot, { backgroundColor: priorityColors[p] }]} />
                  <Text style={[styles.priorityText, priority === p && styles.priorityTextActive]}>
                    {t(`task.${p}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.formActions}>
            <Pressable onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={creating || !title.trim()}
              style={[styles.saveBtn, (creating || !title.trim()) && styles.saveBtnDisabled]}
            >
              {creating
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Text style={styles.saveBtnText}>{t('common.save')}</Text>
              }
            </Pressable>
          </View>
        </View>
      )}

      {/* Task list */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#94a3b8" />
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('task.noTasks')}</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([status, items]) => {
            if (items.length === 0) return null
            return (
              <View key={status}>
                <View style={styles.statusHeader}>
                  <Text style={styles.statusLabel}>
                    {statusLabels[status]} ({items.length})
                  </Text>
                </View>
                {items.map((task) => (
                  <View key={task.id} style={styles.taskItem}>
                    <View style={styles.taskMain}>
                      <View style={[styles.taskDot, { backgroundColor: priorityColors[task.priority] }]} />
                      <View style={styles.taskInfo}>
                        <Text
                          style={[
                            styles.taskTitle,
                            task.status === 'done' && styles.taskTitleDone,
                          ]}
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                        {task.description ? (
                          <Text style={styles.taskDescription} numberOfLines={2}>
                            {task.description}
                          </Text>
                        ) : null}
                        <View style={styles.taskMeta}>
                          {task.assignee && (
                            <View style={styles.taskAssignee}>
                              <EntityAvatar entity={task.assignee} size="xs" />
                              <Text style={styles.taskMetaText}>{entityDisplayName(task.assignee)}</Text>
                            </View>
                          )}
                          {task.due_date && (
                            <View style={styles.taskDueDate}>
                              <Calendar size={10} color="#94a3b8" />
                              <Text style={styles.taskMetaText}>
                                {new Date(task.due_date).toLocaleDateString()}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {!isArchived && (
                        <View style={styles.taskActions}>
                          {task.status !== 'done' && (
                            <Pressable
                              onPress={() => handleStatusChange(task, task.status === 'pending' ? 'in_progress' : 'done')}
                              style={styles.taskActionBtn}
                            >
                              {task.status === 'pending'
                                ? <Clock size={14} color="#94a3b8" />
                                : <Check size={14} color="#16a34a" />
                              }
                            </Pressable>
                          )}
                          <Pressable onPress={() => handleDelete(task)} style={styles.taskActionBtn}>
                            <Trash2 size={14} color="#94a3b8" />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )
          })
        )}
      </ScrollView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  archivedLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  formInput: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 12,
    color: '#1e293b',
  },
  formTextarea: {
    height: 56,
    textAlignVertical: 'top',
    paddingTop: 6,
  },
  formOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 4,
  },
  priorityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  priorityBtnActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 10,
    color: '#64748b',
  },
  priorityTextActive: {
    color: '#6366f1',
    fontWeight: '500',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ffffff',
  },
  scrollContent: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statusHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fafbfc',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  taskMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  taskInfo: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e293b',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  taskDescription: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  taskAssignee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  taskMetaText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  taskActionBtn: {
    padding: 4,
    borderRadius: 4,
  },
})
