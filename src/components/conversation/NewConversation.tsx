import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, FlatList, Pressable, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Bot, Users, Search, X, Check, ArrowLeft, MessageSquare, Plus,
} from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { Entity } from '../../lib/types'
import { EntityAvatar } from '../ui/EntityAvatar'

type Step = 'choose' | 'chat-with-bot' | 'create-group'

interface Props {
  visible: boolean
  onClose: () => void
  onCreated: (convId: number) => void
  preselectedEntityId?: number
}

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

function isBotOrService(entity?: Entity | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

export function NewConversation({ visible, onClose, onCreated, preselectedEntityId }: Props) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)!
  const myEntity = useAuthStore((s) => s.entity)!
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>(preselectedEntityId ? 'create-group' : 'choose')
  const [search, setSearch] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set(preselectedEntityId ? [preselectedEntityId] : []))
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    api.listEntities(token).then((res) => {
      if (res.ok && res.data) {
        const all = Array.isArray(res.data) ? res.data : []
        setEntities(all.filter((e) => e.id !== myEntity.id))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [visible, token, myEntity.id])

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setStep(preselectedEntityId ? 'create-group' : 'choose')
        setSearch('')
        setGroupTitle('')
        setSelected(new Set(preselectedEntityId ? [preselectedEntityId] : []))
      }, 300)
    }
  }, [visible, preselectedEntityId])

  const bots = useMemo(() => entities.filter((e) => isBotOrService(e)), [entities])
  const allFiltered = useMemo(() => {
    if (!search) return entities
    const q = search.toLowerCase()
    return entities.filter((e) =>
      entityDisplayName(e).toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    )
  }, [entities, search])

  const botsFiltered = useMemo(() => {
    if (!search) return bots
    const q = search.toLowerCase()
    return bots.filter((e) =>
      entityDisplayName(e).toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    )
  }, [bots, search])

  const toggleSelect = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleChatWithBot = async (bot: Entity) => {
    setCreating(true)
    const res = await api.createConversation(token, {
      title: entityDisplayName(bot),
      conv_type: 'direct',
      participant_ids: [bot.id],
    })
    if (res.ok && res.data) {
      onCreated(res.data.id)
    }
    setCreating(false)
  }

  const handleCreateGroup = async () => {
    if (selected.size === 0) return
    setCreating(true)
    const title = groupTitle || `Group (${selected.size + 1} members)`
    const res = await api.createConversation(token, {
      title,
      conv_type: 'group',
      participant_ids: Array.from(selected),
    })
    if (res.ok && res.data) {
      onCreated(res.data.id)
    }
    setCreating(false)
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Step: Choose */}
        {step === 'choose' && (
          <View style={styles.chooseContainer}>
            <View style={styles.chooseHeader}>
              <Text style={styles.chooseTitle}>{t('conversation.newChat')}</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <X size={16} color="#94a3b8" />
              </Pressable>
            </View>
            <View style={styles.chooseOptions}>
              <Pressable onPress={() => setStep('chat-with-bot')} style={styles.chooseOption}>
                <View style={[styles.chooseIcon, { backgroundColor: '#eef2ff' }]}>
                  <Bot size={20} color="#6366f1" />
                </View>
                <View style={styles.chooseOptionText}>
                  <Text style={styles.chooseOptionTitle}>{t('newConversation.chatWithBot')}</Text>
                  <Text style={styles.chooseOptionDesc}>{t('newConversation.chatWithBotDesc')}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setStep('create-group')} style={styles.chooseOption}>
                <View style={[styles.chooseIcon, { backgroundColor: '#f0f9ff' }]}>
                  <Users size={20} color="#0284c7" />
                </View>
                <View style={styles.chooseOptionText}>
                  <Text style={styles.chooseOptionTitle}>{t('newConversation.createGroup')}</Text>
                  <Text style={styles.chooseOptionDesc}>{t('newConversation.createGroupDesc')}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step: Chat with Bot */}
        {step === 'chat-with-bot' && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Pressable onPress={() => { setStep('choose'); setSearch('') }} style={styles.backBtn}>
                <ArrowLeft size={16} color="#94a3b8" />
              </Pressable>
              <Text style={styles.stepTitle}>{t('newConversation.chatWithBot')}</Text>
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchRow}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('bot.searchPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                />
              </View>
            </View>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color="#94a3b8" />
              </View>
            ) : botsFiltered.length === 0 ? (
              <View style={styles.centered}>
                <Bot size={28} color="#94a3b8" />
                <Text style={styles.emptyText}>{t('bot.noAgents')}</Text>
              </View>
            ) : (
              <FlatList
                data={botsFiltered}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: bot }) => (
                  <Pressable
                    onPress={() => handleChatWithBot(bot)}
                    disabled={creating}
                    style={({ pressed }) => [styles.entityRow, pressed && styles.entityRowPressed]}
                  >
                    <EntityAvatar entity={bot} size="md" />
                    <View style={styles.entityInfo}>
                      <Text style={styles.entityName} numberOfLines={1}>{entityDisplayName(bot)}</Text>
                      <Text style={styles.entityHandle}>@{bot.name}</Text>
                    </View>
                    <MessageSquare size={16} color="#94a3b8" />
                  </Pressable>
                )}
              />
            )}
          </View>
        )}

        {/* Step: Create Group */}
        {step === 'create-group' && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <Pressable onPress={() => { setStep('choose'); setSearch('') }} style={styles.backBtn}>
                <ArrowLeft size={16} color="#94a3b8" />
              </Pressable>
              <Text style={styles.stepTitle}>{t('newConversation.createGroup')}</Text>
            </View>

            <View style={styles.groupTitleContainer}>
              <TextInput
                value={groupTitle}
                onChangeText={setGroupTitle}
                placeholder={t('conversation.groupNamePlaceholder')}
                placeholderTextColor="#94a3b8"
                style={styles.groupTitleInput}
              />
            </View>

            {/* Selected badges */}
            {selected.size > 0 && (
              <View style={styles.selectedContainer}>
                {Array.from(selected).map((id) => {
                  const entity = entities.find((e) => e.id === id)
                  return (
                    <View key={id} style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>{entityDisplayName(entity)}</Text>
                      <Pressable onPress={() => toggleSelect(id)}>
                        <X size={12} color="#6366f1" />
                      </Pressable>
                    </View>
                  )
                })}
              </View>
            )}

            <View style={styles.searchContainer}>
              <View style={styles.searchRow}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('conversation.search')}
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                />
              </View>
            </View>

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color="#94a3b8" />
              </View>
            ) : (
              <FlatList
                data={allFiltered}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: entity }) => (
                  <Pressable
                    onPress={() => toggleSelect(entity.id)}
                    style={[
                      styles.entityRow,
                      selected.has(entity.id) && styles.entityRowSelected,
                    ]}
                  >
                    <EntityAvatar entity={entity} size="sm" />
                    <View style={styles.entityInfo}>
                      <Text style={styles.entityName} numberOfLines={1}>{entityDisplayName(entity)}</Text>
                      <Text style={styles.entityHandle}>{entity.entity_type}</Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      selected.has(entity.id) && styles.checkboxActive,
                    ]}>
                      {selected.has(entity.id) && <Check size={12} color="#ffffff" />}
                    </View>
                  </Pressable>
                )}
              />
            )}

            <View style={styles.createFooter}>
              <Pressable
                onPress={handleCreateGroup}
                disabled={creating || selected.size === 0}
                style={[styles.createBtn, (creating || selected.size === 0) && styles.createBtnDisabled]}
              >
                {creating
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Plus size={16} color="#ffffff" />
                }
                <Text style={styles.createBtnText}>
                  {t('newConversation.createGroupButton', { count: selected.size })}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  chooseContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  chooseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chooseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
    flex: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseOptions: {
    gap: 8,
  },
  chooseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    minHeight: 56,
  },
  chooseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseOptionText: {
    flex: 1,
  },
  chooseOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  chooseOptionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    padding: 0,
  },
  groupTitleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  groupTitleInput: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    fontSize: 14,
    color: '#1e293b',
  },
  selectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366f1',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 52,
  },
  entityRowPressed: {
    backgroundColor: '#f1f5f9',
  },
  entityRowSelected: {
    backgroundColor: '#eef2ff',
  },
  entityInfo: {
    flex: 1,
    minWidth: 0,
  },
  entityName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  entityHandle: {
    fontSize: 10,
    color: '#94a3b8',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  createFooter: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6366f1',
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
})
