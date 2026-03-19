import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import {
  ArrowLeft, Wifi, WifiOff, User, MessageSquare, Users,
  ChevronRight, ChevronDown, ChevronUp, Hash, Calendar, Tag, Key, Copy, Check,
  Clock, PowerOff, RotateCcw, Activity, RefreshCw,
} from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { Entity, Conversation } from '../../lib/types'
import { EntityAvatar } from '../ui/EntityAvatar'
import { useThemeColors } from '../../lib/theme'

interface Props {
  bot: Entity | null
  createdCredentials?: { entity: Entity; key: string; doc: string } | null
  onDismissCredentials?: () => void
  onBack: () => void
  onOpenConversation: (convId: number) => void
  onDisable: (id: number) => void
  onReactivate: (id: number) => void
  onStartChat: (entityId: number) => void
  onRefresh?: () => void
}

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

export function BotDetail({
  bot, createdCredentials, onDismissCredentials, onBack,
  onOpenConversation, onDisable, onReactivate, onStartChat, onRefresh,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const token = useAuthStore((s) => s.token)!
  const myEntity = useAuthStore((s) => s.entity)!
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(false)
  const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('direct')
  const [selfCheck, setSelfCheck] = useState<{
    ready: boolean; recommendation: string[]; has_api_key: boolean; has_bootstrap: boolean
  } | null>(null)
  const [diagnostics, setDiagnostics] = useState<{
    online: boolean; connections: number; disconnect_count: number;
    forced_disconnect_count?: number; last_seen?: string;
    hub: { total_ws_connections: number }
  } | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | false>(false)
  const [convsCollapsed, setConvsCollapsed] = useState(false)
  const [rotatingToken, setRotatingToken] = useState(false)
  const [rotatedToken, setRotatedToken] = useState<string | null>(null)
  const [opError, setOpError] = useState<string | null>(null)
  const [opInfo, setOpInfo] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (!bot) return
    let cancelled = false
    setLoadingConvs(true)
    setActiveTab('direct')
    setConvsCollapsed(false)
    setRotatingToken(false)
    setRotatedToken(null)
    setOpError(null)
    setOpInfo(null)
    setSelfCheck(null)
    setDiagnostics(null)
    setLastSeen(null)

    api.listConversations(token).then((res) => {
      if (cancelled) return
      if (res.ok && res.data) {
        const convs = (res.data as Conversation[]).filter((c) =>
          c.participants?.some((p) => p.entity_id === bot.id)
        )
        setConversations(convs)
      }
      setLoadingConvs(false)
    }).catch(() => {
      if (!cancelled) setLoadingConvs(false)
    })

    // Fetch presence
    api.batchPresence(token, [bot.id]).then((res) => {
      if (!cancelled && res.ok && res.data?.presence) {
        setIsOnline(!!res.data.presence[String(bot.id)])
      }
    }).catch(() => {})

    return () => { cancelled = true }
  }, [bot, token])

  const isOwner = !!(bot && myEntity && bot.owner_id === myEntity.id)

  useEffect(() => {
    if (!bot) return
    let cancelled = false

    if (isOwner) {
      api.getEntitySelfCheck(token, bot.id).then((res) => {
        if (!cancelled && res.ok && res.data) setSelfCheck(res.data)
      }).catch(() => {})
      api.getEntityDiagnostics(token, bot.id).then((res) => {
        if (!cancelled && res.ok && res.data) setDiagnostics(res.data)
      }).catch(() => {})
    }

    api.getEntityStatus(token, bot.id).then((res) => {
      if (!cancelled && res.ok && res.data?.last_seen) setLastSeen(res.data.last_seen)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [bot, token, isOwner])

  const handleCopy = useCallback(async (text: string, label: string) => {
    await Clipboard.setStringAsync(text)
    setCopied(label)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleRegenerateToken = useCallback(async () => {
    if (!bot || rotatingToken) return
    Alert.alert(
      t('bot.regenerateToken'),
      t('bot.regenerateConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('bot.regenerateToken'),
          style: 'destructive',
          onPress: async () => {
            setRotatingToken(true)
            setOpError(null)
            const res = await api.regenerateEntityToken(token, bot.id)
            if (res.ok && res.data?.api_key) {
              setRotatedToken(res.data.api_key)
              await Clipboard.setStringAsync(res.data.api_key)
              setCopied('rotated-token')
              setOpInfo(t('bot.regenerateResult', { count: res.data.disconnected ?? 0 }))
              onRefresh?.()
            } else {
              const detail = typeof res.error === 'string'
                ? res.error
                : (res.error?.message || t('common.errorUnexpected'))
              setOpError(detail)
            }
            setRotatingToken(false)
          },
        },
      ]
    )
  }, [bot, rotatingToken, token, t, onRefresh])

  if (!bot) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t('bot.agentDetails')}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{t('bot.selectAgent')}</Text>
      </View>
    )
  }

  const isDisabled = bot.status === 'disabled'
  const meta = bot.metadata as Record<string, unknown> | undefined
  const description = (meta?.description as string) || ''
  const tags = (meta?.tags as string[]) || []
  const ownerEntity = bot.owner_id === myEntity?.id ? myEntity : null
  const directConvs = conversations.filter((c) => c.conv_type === 'direct')
  const groupConvs = conversations.filter((c) => c.conv_type === 'group' || c.conv_type === 'channel')
  const tabConvs = activeTab === 'direct' ? directConvs : groupConvs

  const showFullCreds = createdCredentials && createdCredentials.entity.id === bot.id
  const accessToken = rotatedToken || (showFullCreds ? createdCredentials?.key : null)

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={16} color={colors.textMuted} />
        </Pressable>
        <EntityAvatar entity={bot} size="md" showStatus isOnline={isOnline} />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{entityDisplayName(bot)}</Text>
          <Text style={[styles.headerHandle, { color: colors.textMuted }]}>@{bot.name}</Text>
        </View>
        <View style={[
          styles.headerBadge,
          isDisabled ? styles.badgeWarning : isOnline ? styles.badgeOnline : styles.badgeOffline,
        ]}>
          {isDisabled ? <PowerOff size={12} color="#d97706" /> :
           isOnline ? <Wifi size={12} color="#16a34a" /> : <WifiOff size={12} color="#94a3b8" />}
          <Text style={[
            styles.badgeText,
            isDisabled ? { color: '#d97706' } : isOnline ? { color: '#16a34a' } : { color: '#94a3b8' },
          ]}>
            {isDisabled ? t('bot.disabled') : isOnline ? t('common.online') : t('common.offline')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Credential banner */}
        {isOwner && showFullCreds && createdCredentials && (
          <View style={[styles.credBanner, { backgroundColor: `${colors.warning}12`, borderBottomColor: colors.border }]}>
            <View style={styles.credHeader}>
              <View style={styles.credHeaderLeft}>
                <Key size={16} color={colors.warning} />
                <Text style={[styles.credTitle, { color: colors.warning }]}>
                  {t('bot.apiKey')} -- {t('bot.saveKeyWarning')}
                </Text>
              </View>
              <Pressable onPress={onDismissCredentials}>
                <Text style={[styles.dismissText, { color: colors.textMuted }]}>{t('common.dismiss')}</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => handleCopy(createdCredentials.key, 'bootstrap')}
              style={styles.credKeyRow}
            >
              <Text style={[styles.credKeyLabel, { color: colors.warning }]}>Key</Text>
              <Text style={[styles.credKeyValue, { color: colors.text, backgroundColor: colors.bg }]} numberOfLines={1}>
                {copied === 'bootstrap'
                  ? createdCredentials.key
                  : `${createdCredentials.key.slice(0, 8)}${'*'.repeat(24)}${createdCredentials.key.slice(-4)}`
                }
              </Text>
              {copied === 'bootstrap'
                ? <Check size={12} color={colors.success} />
                : <Copy size={12} color={colors.textMuted} />
              }
            </Pressable>
          </View>
        )}

        {/* Status overview (owner only) */}
        {isOwner && (selfCheck || diagnostics) && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Activity size={16} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bot.statusSection')}</Text>
              </View>
              <View style={[
                styles.readyBadge,
                { backgroundColor: selfCheck?.ready ? `${colors.success}16` : `${colors.warning}16` },
              ]}>
                <Text style={[
                  styles.readyText,
                  { color: selfCheck?.ready ? colors.success : colors.warning },
                ]}>
                  {selfCheck?.ready ? t('bot.statusReady') : t('bot.statusActionNeeded')}
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('bot.apiKey')}</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {selfCheck?.has_api_key ? t('bot.apiKeyConfigured') : t('bot.apiKeyMissing')}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('bot.connections')}</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>{diagnostics?.connections ?? 0}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('bot.hubWs')}</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>{diagnostics?.hub?.total_ws_connections ?? 0}</Text>
              </View>
            </View>

            {(selfCheck?.recommendation || []).length > 0 && (
              <View style={[styles.recBox, { backgroundColor: `${colors.warning}14` }]}>
                {(selfCheck?.recommendation || []).map((item, i) => (
                  <Text key={i} style={[styles.recText, { color: colors.textSecondary }]}>- {item}</Text>
                ))}
              </View>
            )}

            {opError && (
              <View style={[styles.errorBox, { backgroundColor: `${colors.error}14` }]}>
                <Text style={[styles.errorBoxText, { color: colors.error }]}>{opError}</Text>
              </View>
            )}
            {opInfo && (
              <View style={[styles.successBox, { backgroundColor: `${colors.success}14` }]}>
                <Text style={[styles.successBoxText, { color: colors.success }]}>{opInfo}</Text>
              </View>
            )}

            <View style={styles.actionRow}>
              <Pressable
                onPress={handleRegenerateToken}
                disabled={rotatingToken || isDisabled}
                style={[styles.actionBtn, { backgroundColor: colors.accentDim }, (rotatingToken || isDisabled) && styles.actionBtnDisabled]}
              >
                {rotatingToken ? <RefreshCw size={12} color={colors.accent} /> : <Key size={12} color={colors.accent} />}
                <Text style={[styles.actionBtnAccent, { color: colors.accent }]}>{t('bot.regenerateToken')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Bot info */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          {description ? (
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{description}</Text>
          ) : null}

          <View style={styles.infoRows}>
            <InfoRow icon={User} label={t('bot.owner')} colors={colors}>
              {ownerEntity ? (
                <View style={styles.ownerRow}>
                  <EntityAvatar entity={ownerEntity} size="xs" />
                  <Text style={[styles.infoValue, { color: colors.text }]}>{entityDisplayName(ownerEntity)}</Text>
                </View>
              ) : (
                <Text style={[styles.infoValueMuted, { color: colors.textMuted }]}>#{bot.owner_id || '--'}</Text>
              )}
            </InfoRow>
            <InfoRow icon={Tag} label={t('bot.type')} colors={colors}>
              <Text style={[styles.infoValue, { color: colors.text }]}>{bot.entity_type}</Text>
            </InfoRow>
            <InfoRow icon={Hash} label="ID" colors={colors}>
              <Text style={[styles.infoValue, styles.mono, { color: colors.text }]}>{bot.id}</Text>
            </InfoRow>
            <InfoRow icon={Calendar} label={t('bot.createdAt')} colors={colors}>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {bot.created_at ? new Date(bot.created_at).toLocaleDateString() : '--'}
              </Text>
            </InfoRow>
            {lastSeen && (
              <InfoRow icon={Clock} label={t('bot.lastSeen')} colors={colors}>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {new Date(lastSeen).toLocaleString()}
                </Text>
              </InfoRow>
            )}
          </View>

          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((tag, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: colors.accentDim }]}>
                  <Text style={[styles.tagText, { color: colors.accent }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            {isOwner && isDisabled ? (
              <Pressable onPress={() => onReactivate(bot.id)} style={[styles.reactivateBtn, { backgroundColor: `${colors.success}16` }]}>
                <RotateCcw size={14} color={colors.success} />
                <Text style={[styles.reactivateBtnText, { color: colors.success }]}>{t('bot.reactivate')}</Text>
              </Pressable>
            ) : (
              <>
                {!isDisabled && (
                  <Pressable onPress={() => onStartChat(bot.id)} style={[styles.chatBtn, { backgroundColor: colors.accentDim }]}>
                    <MessageSquare size={14} color={colors.accent} />
                    <Text style={[styles.chatBtnText, { color: colors.accent }]}>{t('conversation.newChat')}</Text>
                  </Pressable>
                )}
                {isOwner && !isDisabled && (
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        t('bot.disableAgent'),
                        t('bot.disableConfirm', { name: entityDisplayName(bot) }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          { text: t('bot.disableAgent'), style: 'destructive', onPress: () => onDisable(bot.id) },
                        ]
                      )
                    }}
                    style={styles.disableBtn}
                  >
                    <PowerOff size={14} color={colors.textMuted} />
                    <Text style={[styles.disableBtnText, { color: colors.textMuted }]}>{t('bot.disableAgent')}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>

        {/* Conversations */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => setConvsCollapsed(!convsCollapsed)}
            style={styles.convToggle}
          >
            {convsCollapsed
              ? <ChevronRight size={16} color={colors.textMuted} />
              : <ChevronDown size={16} color={colors.textMuted} />
            }
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bot.conversations')}</Text>
            <Text style={[styles.convCount, { color: colors.textMuted }]}>({conversations.length})</Text>
          </Pressable>

          {!convsCollapsed && (
            <>
              <View style={[styles.tabRow, { backgroundColor: colors.bgHover }]}>
                <Pressable
                  onPress={() => setActiveTab('direct')}
                  style={[styles.tabBtn, activeTab === 'direct' && [styles.tabBtnActive, { backgroundColor: colors.bg }]]}
                >
                  <MessageSquare size={14} color={activeTab === 'direct' ? colors.text : colors.textMuted} />
                  <Text style={[styles.tabText, { color: activeTab === 'direct' ? colors.text : colors.textMuted }, activeTab === 'direct' && styles.tabTextActive]}>
                    {t('conversation.direct')}
                  </Text>
                  <View style={[styles.tabCount, { backgroundColor: colors.bgHover }]}>
                    <Text style={styles.tabCountText}>{directConvs.length}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('groups')}
                  style={[styles.tabBtn, activeTab === 'groups' && [styles.tabBtnActive, { backgroundColor: colors.bg }]]}
                >
                  <Users size={14} color={activeTab === 'groups' ? colors.text : colors.textMuted} />
                  <Text style={[styles.tabText, { color: activeTab === 'groups' ? colors.text : colors.textMuted }, activeTab === 'groups' && styles.tabTextActive]}>
                    {t('conversation.group')}
                  </Text>
                  <View style={[styles.tabCount, { backgroundColor: colors.bgHover }]}>
                    <Text style={styles.tabCountText}>{groupConvs.length}</Text>
                  </View>
                </Pressable>
              </View>

              {loadingConvs ? (
                <View style={styles.convLoading}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                </View>
              ) : tabConvs.length === 0 ? (
                <Text style={[styles.noConvs, { color: colors.textMuted }]}>{t('bot.noConversations')}</Text>
              ) : (
                tabConvs.map((conv) => (
                  <Pressable
                    key={conv.id}
                    onPress={() => onOpenConversation(conv.id)}
                    style={({ pressed }) => [styles.convItem, { backgroundColor: colors.bg }, pressed && { backgroundColor: colors.bgHover }]}
                  >
                    <View style={[
                      styles.convIcon,
                      { backgroundColor: conv.conv_type === 'direct' ? colors.accentDim : `${colors.success}16` },
                    ]}>
                      {conv.conv_type === 'direct'
                        ? <MessageSquare size={16} color={colors.accent} />
                        : <Users size={16} color={colors.success} />
                      }
                    </View>
                    <View style={styles.convInfo}>
                      <Text style={[styles.convTitle, { color: colors.text }]} numberOfLines={1}>
                        {conv.title || t('conversation.unnamed')}
                      </Text>
                      <Text style={[styles.convDate, { color: colors.textMuted }]}>
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function InfoRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ size: number; color: string }>
  label: string
  children: React.ReactNode
  colors: ReturnType<typeof useThemeColors>
}) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.label}>
        <Icon size={14} color={colors.textMuted} />
        <Text style={[infoStyles.labelText, { color: colors.textMuted }]}>{label}</Text>
      </View>
      {children}
    </View>
  )
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 96,
    flexShrink: 0,
  },
  labelText: {
    fontSize: 12,
    color: '#94a3b8',
  },
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerHandle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeOnline: { backgroundColor: '#dcfce7' },
  badgeOffline: { backgroundColor: '#f1f5f9' },
  badgeWarning: { backgroundColor: '#fef3c7' },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
  },
  credBanner: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fffbeb',
  },
  credHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  credHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  credTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  dismissText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  credKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  credKeyLabel: {
    fontSize: 12,
    color: '#d97706',
    width: 32,
    flexShrink: 0,
  },
  credKeyValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#1e293b',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  readyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  readyGreen: { backgroundColor: '#dcfce7' },
  readyWarning: { backgroundColor: '#fef3c7' },
  readyText: { fontSize: 12, fontWeight: '500' },
  metricsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  metric: {},
  metricLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e293b',
  },
  recBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  recText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorBoxText: { fontSize: 12, color: '#dc2626' },
  successBox: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  successBoxText: { fontSize: 12, color: '#16a34a' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnAccent: {
    fontSize: 12,
    color: '#6366f1',
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 16,
  },
  infoRows: {
    gap: 4,
  },
  infoValue: {
    fontSize: 12,
    color: '#1e293b',
  },
  infoValueMuted: {
    fontSize: 12,
    color: '#94a3b8',
  },
  mono: {
    fontFamily: 'monospace',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: '#eef2ff',
  },
  tagText: {
    fontSize: 12,
    color: '#6366f1',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  chatBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366f1',
  },
  reactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
  },
  reactivateBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#16a34a',
  },
  disableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  disableBtnText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  convToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  convCount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#f8fafc',
    padding: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#1e293b',
  },
  tabCount: {
    backgroundColor: '#f1f5f9',
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabCountText: {
    fontSize: 12,
  },
  convLoading: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noConvs: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    paddingVertical: 24,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  convIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convInfo: {
    flex: 1,
    minWidth: 0,
  },
  convTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  convDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
})
