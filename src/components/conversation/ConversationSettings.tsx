import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, Switch, Alert,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import Constants from 'expo-constants'
import {
  X, UserMinus, UserPlus, Bell, BellOff, Crown, Shield, Eye,
  Pencil, Check, LogOut, Archive, VolumeX, Volume2, ArrowLeft, Search,
  Terminal, Link2, Plus, Trash2, Loader2,
} from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import { API_BASE_URL } from '../../lib/constants'
import type { Conversation, Entity, ConversationMemory, SubscriptionMode } from '../../lib/types'
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

interface InviteLink {
  id: number
  code: string
  use_count: number
  max_uses: number
  expires_at?: string
}

function buildInviteUrl(code: string): string {
  const configuredBase = Constants.expoConfig?.extra?.apiBaseUrl
  const rawBase = typeof configuredBase === 'string' && configuredBase
    ? configuredBase
    : (API_BASE_URL || 'https://ani-web.51pwd.com')
  return `${rawBase.replace(/\/+$/, '')}/join/${code}`
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
  const [subscriptionMode, setSubscriptionMode] = useState<SubscriptionMode | undefined>(undefined)
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [prompt, setPrompt] = useState(conversation.prompt || '')
  const [promptValue, setPromptValue] = useState(conversation.prompt || '')
  const [memories, setMemories] = useState<ConversationMemory[]>([])
  const [loadingMemories, setLoadingMemories] = useState(false)
  const [showMemoryForm, setShowMemoryForm] = useState(false)
  const [memoryKey, setMemoryKey] = useState('')
  const [memoryContent, setMemoryContent] = useState('')
  const [memorySaving, setMemorySaving] = useState(false)
  const [memoryClearing, setMemoryClearing] = useState(false)
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null)

  const participants = conversation?.participants || []
  const myParticipant = participants.find((p) => p.entity_id === myEntity?.id)
  const canManage = myParticipant?.role === 'owner' || myParticipant?.role === 'admin'
  const isGroup = conversation?.conv_type === 'group' || conversation?.conv_type === 'channel'
  const displayConversationId = conversation?.public_id || String(conversation?.id || 0)
  const contextMessages = conversation.last_message ? 1 : 0

  React.useEffect(() => {
    setSubscriptionMode(myParticipant?.subscription_mode)
  }, [myParticipant?.subscription_mode])

  React.useEffect(() => {
    let cancelled = false
    setLoadingPrompt(true)
    setLoadingMemories(true)
    api.listMemories(token, conversation.id).then((res) => {
      if (cancelled || !res.ok || !res.data) return
      setPrompt(res.data.prompt || '')
      setPromptValue(res.data.prompt || '')
      setMemories(res.data.memories || [])
    }).catch(() => {
      // Best-effort load for optional settings content.
    }).finally(() => {
      if (!cancelled) {
        setLoadingPrompt(false)
        setLoadingMemories(false)
      }
    })
    return () => { cancelled = true }
  }, [token, conversation.id])

  React.useEffect(() => {
    if (!canManage || !isGroup) return
    let cancelled = false
    setLoadingInvites(true)
    api.listInviteLinks(token, conversation.id).then((res) => {
      if (cancelled || !res.ok || !res.data) return
      setInviteLinks(Array.isArray(res.data) ? res.data : [])
    }).catch(() => {
      // Best-effort load for optional settings content.
    }).finally(() => {
      if (!cancelled) setLoadingInvites(false)
    })
    return () => { cancelled = true }
  }, [token, conversation.id, canManage, isGroup])

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

  const handleSubscriptionChange = async (nextMode: SubscriptionMode, enabled: boolean) => {
    if (!enabled || !myParticipant) return
    const prevMode = subscriptionMode
    setSubscriptionMode(nextMode)
    const res = await api.updateSubscription(token, conversation.id, nextMode)
    if (!res.ok) {
      setSubscriptionMode(prevMode)
      return
    }

    const nextParticipants = participants.map((participant) =>
      participant.entity_id === myParticipant.entity_id
        ? { ...participant, subscription_mode: nextMode }
        : participant
    )
    onUpdated?.({ participants: nextParticipants })
  }

  const handleSavePrompt = async () => {
    setSaving(true)
    const res = await api.updateConversation(token, conversation.id, { prompt: promptValue.trim() })
    if (res.ok) {
      setPrompt(promptValue.trim())
      onUpdated?.({ prompt: promptValue.trim() })
      setEditingPrompt(false)
    }
    setSaving(false)
  }

  const handleSaveMemory = async () => {
    if (!memoryKey.trim() || !memoryContent.trim()) return
    setMemorySaving(true)
    const res = await api.upsertMemory(token, conversation.id, memoryKey.trim(), memoryContent.trim())
    if (res.ok && res.data) {
      setMemories((prev) => {
        const others = prev.filter((item) => item.id !== res.data!.id && item.key !== res.data!.key)
        return [...others, res.data!]
      })
      setShowMemoryForm(false)
      setMemoryKey('')
      setMemoryContent('')
    }
    setMemorySaving(false)
  }

  const handleDeleteMemory = async (memoryId: number) => {
    const res = await api.deleteMemory(token, conversation.id, memoryId)
    if (res.ok) {
      setMemories((prev) => prev.filter((item) => item.id !== memoryId))
    }
  }

  const handleClearMemories = async () => {
    setMemoryClearing(true)
    for (const memory of memories) {
      await api.deleteMemory(token, conversation.id, memory.id)
    }
    setMemories([])
    setMemoryClearing(false)
  }

  const handleCreateInvite = async () => {
    setCreatingInvite(true)
    const res = await api.createInviteLink(token, conversation.id, { max_uses: 0, expires_in: 86400 * 7 })
    if (res.ok) {
      const listRes = await api.listInviteLinks(token, conversation.id)
      if (listRes.ok && listRes.data) {
        setInviteLinks(Array.isArray(listRes.data) ? listRes.data : [])
      }
    }
    setCreatingInvite(false)
  }

  const handleCopyInvite = async (link: InviteLink) => {
    await Clipboard.setStringAsync(buildInviteUrl(link.code))
    setCopiedInviteId(link.id)
    setTimeout(() => setCopiedInviteId(null), 2000)
  }

  const handleDeleteInvite = async (inviteId: number) => {
    const res = await api.deleteInviteLink(token, inviteId)
    if (res.ok) {
      setInviteLinks((prev) => prev.filter((item) => item.id !== inviteId))
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
            <View style={styles.modeSection}>
              <View style={styles.toggleLabel}>
                {subscriptionMode === 'subscribe_all' || subscriptionMode === 'mention_with_context'
                  ? <Bell size={14} color="#64748b" />
                  : <BellOff size={14} color="#94a3b8" />}
                <Text style={styles.toggleText}>{t('settings.mode')}</Text>
              </View>
              <View style={styles.modeOptions}>
                {(['mention_only', 'subscribe_all', 'mention_with_context', 'subscribe_digest'] as SubscriptionMode[]).map((mode) => {
                  const selected = subscriptionMode === mode
                  const labelKey =
                    mode === 'mention_only' ? 'mentionOnly' :
                    mode === 'subscribe_all' ? 'allMessages' :
                    mode === 'mention_with_context' ? 'mentionContext' :
                    'digest'
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => handleSubscriptionChange(mode, !isArchived)}
                      disabled={isArchived}
                      style={[styles.modeChip, selected && styles.modeChipActive, isArchived && styles.disabledChip]}
                    >
                      <Text style={[styles.modeChipText, selected && styles.modeChipTextActive]}>
                        {t(`settings.${labelKey}`)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>
        )}

        {/* Conversation instructions */}
        <View style={styles.section}>
          <View style={styles.inlineSectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Terminal size={12} color="#94a3b8" />
              <Text style={styles.sectionLabelInline}>{t('agentConfig.prompt')}</Text>
            </View>
            {canManage && !isArchived && !loadingPrompt && (
              <Pressable onPress={() => { setPromptValue(prompt); setEditingPrompt((prev) => !prev) }} style={styles.iconBtn}>
                <Pencil size={12} color="#94a3b8" />
              </Pressable>
            )}
          </View>
          {loadingPrompt ? (
            <ActivityIndicator size="small" color="#94a3b8" style={styles.inlineLoader} />
          ) : editingPrompt ? (
            <View style={styles.editColumn}>
              <TextInput
                value={promptValue}
                onChangeText={setPromptValue}
                style={[styles.input, styles.textarea]}
                multiline
                numberOfLines={3}
                autoFocus
              />
              <View style={styles.editActions}>
                <Pressable onPress={handleSavePrompt} disabled={saving} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>{t('common.save')}</Text>
                </Pressable>
                <Pressable onPress={() => { setPromptValue(prompt); setEditingPrompt(false) }}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.bodyText}>{prompt || t('agentConfig.noPrompt')}</Text>
          )}
        </View>

        {/* Memories */}
        <View style={styles.section}>
          <View style={styles.memoryStats}>
            <Text style={styles.memoryStatsText}>
              {t('context.messages')}: {contextMessages} | {t('memory.memories')}: {memories.length}
            </Text>
          </View>
          <View style={styles.inlineSectionHeader}>
            <Text style={styles.sectionLabelInline}>{t('memory.memories')} ({memories.length})</Text>
            {canManage && !isArchived && (
              <Pressable onPress={() => setShowMemoryForm((prev) => !prev)} style={styles.iconBtn}>
                <Plus size={12} color="#6366f1" />
              </Pressable>
            )}
          </View>
          {loadingMemories ? (
            <ActivityIndicator size="small" color="#94a3b8" style={styles.inlineLoader} />
          ) : (
            <>
              {showMemoryForm && canManage && !isArchived && (
                <View style={styles.memoryForm}>
                  <TextInput
                    value={memoryKey}
                    onChangeText={setMemoryKey}
                    placeholder={t('memory.keyPlaceholder')}
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                  <TextInput
                    value={memoryContent}
                    onChangeText={setMemoryContent}
                    placeholder={t('memory.contentPlaceholder')}
                    placeholderTextColor="#94a3b8"
                    style={[styles.input, styles.textarea]}
                    multiline
                    numberOfLines={2}
                  />
                  <View style={styles.editActions}>
                    <Pressable onPress={handleSaveMemory} disabled={memorySaving} style={styles.smallBtn}>
                      {memorySaving
                        ? <Loader2 size={12} color="#ffffff" />
                        : <Text style={styles.smallBtnText}>{t('common.save')}</Text>}
                    </Pressable>
                    <Pressable onPress={() => setShowMemoryForm(false)}>
                      <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={styles.memoryList}>
                {memories.length === 0 ? (
                  <Text style={styles.emptyText}>{t('memory.noPrompt')}</Text>
                ) : (
                  memories.map((memory) => (
                    <View key={memory.id} style={styles.memoryItem}>
                      <View style={styles.memoryContent}>
                        <Text style={styles.memoryKey}>{memory.key}</Text>
                        <Text style={styles.memoryValue}>{memory.content}</Text>
                      </View>
                      {canManage && !isArchived && (
                        <Pressable onPress={() => handleDeleteMemory(memory.id)} style={styles.iconBtn}>
                          <Trash2 size={12} color="#94a3b8" />
                        </Pressable>
                      )}
                    </View>
                  ))
                )}
              </View>
              {canManage && !isArchived && memories.length > 0 && (
                <Pressable onPress={handleClearMemories} disabled={memoryClearing} style={styles.clearButton}>
                  {memoryClearing
                    ? <ActivityIndicator size="small" color="#dc2626" />
                    : <Text style={styles.clearButtonText}>{t('context.clearMemory')}</Text>}
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* Invite links */}
        {canManage && isGroup && !isArchived && (
          <View style={styles.section}>
            <View style={styles.inlineSectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Link2 size={12} color="#94a3b8" />
                <Text style={styles.sectionLabelInline}>{t('invite.title')}</Text>
              </View>
              <Pressable onPress={handleCreateInvite} disabled={creatingInvite} style={styles.iconBtn}>
                {creatingInvite
                  ? <Loader2 size={12} color="#6366f1" />
                  : <Plus size={12} color="#6366f1" />}
              </Pressable>
            </View>
            {loadingInvites ? (
              <ActivityIndicator size="small" color="#94a3b8" style={styles.inlineLoader} />
            ) : inviteLinks.length === 0 ? (
              <Text style={styles.emptyText}>{t('invite.noLinks')}</Text>
            ) : (
              <View style={styles.inviteList}>
                {inviteLinks.map((link) => (
                  <View key={link.id} style={styles.inviteItem}>
                    <View style={styles.inviteContent}>
                      <Text style={styles.inviteCode} numberOfLines={1}>{link.code}</Text>
                      <Text style={styles.inviteMeta}>
                        {t('invite.uses', { count: link.use_count, max: link.max_uses || '∞' })}
                        {link.expires_at ? ` · ${t('invite.expires', { date: new Date(link.expires_at).toLocaleDateString() })}` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleCopyInvite(link)} style={styles.iconBtn}>
                      {copiedInviteId === link.id
                        ? <Check size={12} color="#16a34a" />
                        : <Pencil size={12} color="#94a3b8" />}
                    </Pressable>
                    <Pressable onPress={() => handleDeleteInvite(link.id)} style={styles.iconBtn}>
                      <Trash2 size={12} color="#94a3b8" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
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
  modeSection: {
    marginTop: 12,
    gap: 8,
  },
  modeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  modeChipText: {
    fontSize: 11,
    color: '#64748b',
  },
  modeChipTextActive: {
    color: '#4338ca',
    fontWeight: '500',
  },
  disabledChip: {
    opacity: 0.5,
  },
  inlineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabelInline: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 20,
  },
  inlineLoader: {
    marginVertical: 8,
  },
  memoryStats: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  memoryStatsText: {
    fontSize: 10,
    color: '#64748b',
  },
  memoryForm: {
    gap: 8,
    marginBottom: 10,
  },
  memoryList: {
    gap: 8,
  },
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  memoryContent: {
    flex: 1,
  },
  memoryKey: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 2,
  },
  memoryValue: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 18,
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#dc2626',
  },
  inviteList: {
    gap: 8,
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inviteContent: {
    flex: 1,
  },
  inviteCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#1e293b',
  },
  inviteMeta: {
    marginTop: 2,
    fontSize: 10,
    color: '#94a3b8',
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
