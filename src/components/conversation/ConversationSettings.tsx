import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, Switch, Alert,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import {
  X, UserMinus, UserPlus, Bell, BellOff, Crown, Shield, Eye,
  Pencil, Check, LogOut, Archive, VolumeX, Volume2, ArrowLeft, Search,
} from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { Conversation, Entity } from '../../lib/types'
import { EntityAvatar } from '../ui/EntityAvatar'

interface Props {
  conversation: Conversation
  onClose: () => void
  onLeave?: () => void
  onUpdated?: (conv: Partial<Conversation>) => void
  isArchived?: boolean
}

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

export function ConversationSettings({ conversation, onClose, onLeave, onUpdated, isArchived }: Props) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)!
  const myEntity = useAuthStore((s) => s.entity)!

  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [titleValue, setTitleValue] = useState(conversation.title || '')
  const [descValue, setDescValue] = useState(conversation.description || '')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [muted, setMuted] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [addableEntities, setAddableEntities] = useState<Entity[]>([])
  const [addMemberSearch, setAddMemberSearch] = useState('')
  const [addMemberLoading, setAddMemberLoading] = useState(false)

  const participants = conversation.participants || []
  const myParticipant = participants.find((p) => p.entity_id === myEntity.id)
  const canManage = myParticipant?.role === 'owner' || myParticipant?.role === 'admin'
  const isGroup = conversation.conv_type === 'group' || conversation.conv_type === 'channel'
  const displayConversationId = conversation.public_id || String(conversation.id)

  const handleSaveTitle = async () => {
    if (!titleValue.trim() || titleValue === conversation.title) {
      setEditingTitle(false)
      return
    }
    setSaving(true)
    const res = await api.updateConversation(token, conversation.id, { title: titleValue.trim() })
    if (res.ok && res.data) {
      onUpdated?.({ title: res.data.title })
    }
    setSaving(false)
    setEditingTitle(false)
  }

  const handleSaveDesc = async () => {
    if (descValue === conversation.description) {
      setEditingDesc(false)
      return
    }
    setSaving(true)
    const res = await api.updateConversation(token, conversation.id, { description: descValue.trim() })
    if (res.ok && res.data) {
      onUpdated?.({ description: res.data.description })
    }
    setSaving(false)
    setEditingDesc(false)
  }

  const handleOpenAddMember = async () => {
    setShowAddMember(true)
    setAddMemberLoading(true)
    const existing = new Set(participants.map((p) => p.entity_id))
    try {
      const res = await api.listEntities(token)
      if (res.ok && res.data) {
        setAddableEntities((res.data as Entity[]).filter((e) => !existing.has(e.id)))
      }
    } catch {
      // Silently fail
    }
    setAddMemberLoading(false)
  }

  const handleAddMember = async (entityId: number) => {
    setAddMemberLoading(true)
    await api.addParticipant(token, conversation.id, entityId, 'member')
    setShowAddMember(false)
    setAddMemberSearch('')
    setAddMemberLoading(false)
  }

  const handleRemoveMember = (entityId: number, name: string) => {
    Alert.alert(
      t('common.removeMember'),
      t('settings.removeMemberConfirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.removeMember'),
          style: 'destructive',
          onPress: () => api.removeParticipant(token, conversation.id, entityId),
        },
      ]
    )
  }

  const handleLeave = async () => {
    Alert.alert(
      t('settings.leave'),
      t('settings.leaveConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.leave'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const res = await api.leaveConversation(token, conversation.id)
            setLoading(false)
            if (res.ok) {
              onLeave?.()
              onClose()
            }
          },
        },
      ]
    )
  }

  const handleArchive = async () => {
    setLoading(true)
    const res = await api.archiveConversation(token, conversation.id)
    setLoading(false)
    if (res.ok) {
      onLeave?.()
      onClose()
    }
  }

  const roleIcon = (role: string) => {
    if (role === 'owner') return <Crown size={12} color="#f59e0b" />
    if (role === 'admin') return <Shield size={12} color="#3b82f6" />
    if (role === 'observer') return <Eye size={12} color="#94a3b8" />
    return null
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn}>
          <ArrowLeft size={16} color="#64748b" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t('settings.title')}
          {isArchived && <Text style={styles.archivedLabel}> ({t('common.archived')})</Text>}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.name')}</Text>
          {editingTitle ? (
            <View style={styles.editRow}>
              <TextInput
                value={titleValue}
                onChangeText={setTitleValue}
                style={[styles.input, { flex: 1 }]}
                autoFocus
                onSubmitEditing={handleSaveTitle}
              />
              <Pressable onPress={handleSaveTitle} disabled={saving} style={styles.iconBtn}>
                <Check size={14} color="#16a34a" />
              </Pressable>
              <Pressable onPress={() => setEditingTitle(false)} style={styles.iconBtn}>
                <X size={14} color="#dc2626" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.valueRow}>
              <Text style={styles.valueText}>{conversation.title || 'Untitled'}</Text>
              {canManage && !isArchived && (
                <Pressable onPress={() => { setTitleValue(conversation.title || ''); setEditingTitle(true) }} style={styles.iconBtn}>
                  <Pencil size={12} color="#94a3b8" />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Conversation ID */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.conversationId')}</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.valueText, styles.mono]}>{displayConversationId}</Text>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(displayConversationId)
                setIdCopied(true)
                setTimeout(() => setIdCopied(false), 2000)
              }}
              style={styles.iconBtn}
            >
              {idCopied ? <Check size={12} color="#16a34a" /> : <Pencil size={12} color="#94a3b8" />}
            </Pressable>
            {idCopied && <Text style={styles.copiedText}>{t('settings.idCopied')}</Text>}
          </View>
        </View>

        {/* Description */}
        {isGroup && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('settings.description')}</Text>
            {editingDesc ? (
              <View style={styles.editColumn}>
                <TextInput
                  value={descValue}
                  onChangeText={setDescValue}
                  style={[styles.input, styles.textarea]}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
                <View style={styles.editActions}>
                  <Pressable onPress={handleSaveDesc} disabled={saving} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>{t('common.save')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingDesc(false)}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.valueRow}>
                <Text style={styles.descText}>
                  {conversation.description || t('settings.noDescription')}
                </Text>
                {canManage && !isArchived && (
                  <Pressable onPress={() => { setDescValue(conversation.description || ''); setEditingDesc(true) }} style={styles.iconBtn}>
                    <Pencil size={12} color="#94a3b8" />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {/* Notification settings */}
        {myParticipant && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('settings.notifications')}</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabel}>
                {muted ? <VolumeX size={14} color="#94a3b8" /> : <Volume2 size={14} color="#64748b" />}
                <Text style={styles.toggleText}>{t('settings.mute')}</Text>
              </View>
              <Switch
                value={muted}
                onValueChange={setMuted}
                disabled={isArchived}
                trackColor={{ false: '#e2e8f0', true: '#6366f1' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        )}

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t('settings.members')} ({participants.length})
          </Text>
          <View style={styles.memberList}>
            {participants.map((p) => (
              <View key={p.entity_id} style={styles.memberItem}>
                <EntityAvatar entity={p.entity} size="xs" />
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    {roleIcon(p.role)}
                    <Text style={styles.memberName} numberOfLines={1}>
                      {entityDisplayName(p.entity)}
                    </Text>
                    {p.entity_id === myEntity.id && (
                      <Text style={styles.youLabel}>{t('common.you')}</Text>
                    )}
                  </View>
                </View>
                {canManage && p.entity_id !== myEntity.id && p.role !== 'owner' && !isArchived && (
                  <Pressable
                    onPress={() => handleRemoveMember(p.entity_id, entityDisplayName(p.entity))}
                    style={styles.removeMemberBtn}
                  >
                    <UserMinus size={12} color="#94a3b8" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Add member */}
          {canManage && isGroup && !isArchived && (
            showAddMember ? (
              <View style={styles.addMemberPanel}>
                <View style={styles.addSearchRow}>
                  <Search size={14} color="#94a3b8" />
                  <TextInput
                    value={addMemberSearch}
                    onChangeText={setAddMemberSearch}
                    placeholder={t('conversation.search')}
                    placeholderTextColor="#94a3b8"
                    style={styles.addSearchInput}
                    autoFocus
                  />
                </View>
                {addMemberLoading ? (
                  <ActivityIndicator size="small" color="#94a3b8" style={{ marginVertical: 8 }} />
                ) : (
                  <View style={styles.addMemberList}>
                    {addableEntities
                      .filter((e) => {
                        if (!addMemberSearch) return true
                        const q = addMemberSearch.toLowerCase()
                        return entityDisplayName(e).toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
                      })
                      .map((e) => (
                        <Pressable
                          key={e.id}
                          onPress={() => handleAddMember(e.id)}
                          style={({ pressed }) => [styles.addMemberItem, pressed && { backgroundColor: '#f1f5f9' }]}
                        >
                          <EntityAvatar entity={e} size="xs" />
                          <Text style={styles.addMemberName} numberOfLines={1}>{entityDisplayName(e)}</Text>
                          <Text style={styles.addMemberType}>{e.entity_type}</Text>
                        </Pressable>
                      ))
                    }
                    {addableEntities.length === 0 && (
                      <Text style={styles.emptyText}>{t('common.noEntities')}</Text>
                    )}
                  </View>
                )}
                <Pressable onPress={() => { setShowAddMember(false); setAddMemberSearch('') }}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={handleOpenAddMember} style={styles.addMemberBtn}>
                <UserPlus size={14} color="#6366f1" />
                <Text style={styles.addMemberBtnText}>{t('common.addMember')}</Text>
              </Pressable>
            )
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          {isGroup && !isArchived && (
            <Pressable onPress={handleArchive} disabled={loading} style={styles.actionItem}>
              <Archive size={14} color="#64748b" />
              <Text style={styles.actionItemText}>{t('settings.archive')}</Text>
            </Pressable>
          )}
          {isGroup && myParticipant?.role !== 'owner' && !isArchived && (
            <Pressable onPress={handleLeave} disabled={loading} style={styles.actionItemDanger}>
              {loading
                ? <ActivityIndicator size="small" color="#dc2626" />
                : <LogOut size={14} color="#dc2626" />
              }
              <Text style={styles.actionItemDangerText}>{t('settings.leave')}</Text>
            </Pressable>
          )}
        </View>
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
  scrollContent: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  editColumn: {
    marginTop: 4,
    gap: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  valueText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  descText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 20,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  copiedText: {
    fontSize: 10,
    color: '#16a34a',
  },
  input: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 14,
    color: '#1e293b',
  },
  textarea: {
    height: 72,
    textAlignVertical: 'top',
    paddingTop: 6,
  },
  iconBtn: {
    padding: 4,
  },
  smallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  smallBtnText: {
    fontSize: 10,
    color: '#ffffff',
  },
  cancelText: {
    fontSize: 10,
    color: '#94a3b8',
    paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 12,
    color: '#64748b',
  },
  memberList: {
    marginTop: 8,
    gap: 4,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e293b',
    flexShrink: 1,
  },
  youLabel: {
    fontSize: 9,
    color: '#94a3b8',
  },
  removeMemberBtn: {
    padding: 4,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  addMemberBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366f1',
  },
  addMemberPanel: {
    marginTop: 8,
    gap: 8,
  },
  addSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    padding: 0,
  },
  addMemberList: {
    maxHeight: 144,
    gap: 2,
  },
  addMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addMemberName: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
  },
  addMemberType: {
    fontSize: 9,
    color: '#94a3b8',
  },
  emptyText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  actionItemText: {
    fontSize: 12,
    color: '#64748b',
  },
  actionItemDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionItemDangerText: {
    fontSize: 12,
    color: '#dc2626',
  },
})
