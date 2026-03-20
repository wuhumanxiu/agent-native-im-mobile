import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, Clock, ExternalLink, MessageSquare, PowerOff, User, Wifi, WifiOff } from 'lucide-react-native'
import { EntityAvatar } from '../ui/EntityAvatar'
import { useThemeColors } from '../../lib/theme'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { Entity } from '../../lib/types'
import { getEntityPresenceSemantic, getEntityStatusLabel } from '../../lib/entity-status'
import { getEntityCapabilityChips, getEntityCapabilitySummary } from '../../lib/entity-capabilities'

interface Props {
  entity: Entity
  isOnline: boolean
  canViewDetails?: boolean
  onClose: () => void
  onStartChat?: (entity: Entity) => void
  onViewDetails?: (entity: Entity) => void
}

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

function isBotOrService(entity?: Entity | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

function formatRelativeLastSeen(lastSeen: string, locale?: string): string {
  const date = new Date(lastSeen)
  if (Number.isNaN(date.getTime())) return lastSeen

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const IntlWithRTF = Intl as typeof Intl & {
    RelativeTimeFormat?: new (locale?: string | string[], options?: Intl.RelativeTimeFormatOptions) => Intl.RelativeTimeFormat
  }
  const rtf = IntlWithRTF.RelativeTimeFormat
    ? new IntlWithRTF.RelativeTimeFormat(locale, { numeric: 'auto' })
    : null

  const fallback = (value: number, unit: 'second' | 'minute' | 'hour' | 'day') => {
    const absValue = Math.abs(value)
    const plural = absValue === 1 ? unit : `${unit}s`
    return value < 0 ? `${absValue} ${plural} ago` : `in ${absValue} ${plural}`
  }

  if (absMs < 60_000) return rtf ? rtf.format(Math.round(diffMs / 1_000), 'second') : fallback(Math.round(diffMs / 1_000), 'second')
  if (absMs < 3_600_000) return rtf ? rtf.format(Math.round(diffMs / 60_000), 'minute') : fallback(Math.round(diffMs / 60_000), 'minute')
  if (absMs < 86_400_000) return rtf ? rtf.format(Math.round(diffMs / 3_600_000), 'hour') : fallback(Math.round(diffMs / 3_600_000), 'hour')
  return rtf ? rtf.format(Math.round(diffMs / 86_400_000), 'day') : fallback(Math.round(diffMs / 86_400_000), 'day')
}

export function EntityQuickSheet({
  entity,
  isOnline,
  canViewDetails = false,
  onClose,
  onStartChat,
  onViewDetails,
}: Props) {
  const { t, i18n } = useTranslation()
  const colors = useThemeColors()
  const token = useAuthStore((s) => s.token)
  const myEntity = useAuthStore((s) => s.entity)
  const isBot = isBotOrService(entity)
  const capabilityChips = useMemo(() => (isBot ? getEntityCapabilityChips(t, entity) : []), [entity, isBot, t])
  const capabilitySummary = useMemo(() => (isBot ? getEntityCapabilitySummary(t, entity) : ''), [entity, isBot, t])
  const [resolvedOnline, setResolvedOnline] = useState(isOnline)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const description = useMemo(() => {
    const raw = entity.metadata?.description
    return typeof raw === 'string' ? raw.trim() : ''
  }, [entity.metadata])
  const tags = useMemo(() => {
    const raw = entity.metadata?.tags
    return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : []
  }, [entity.metadata])
  const typeLabel = entity.entity_type === 'bot'
    ? t('entityPopover.bot')
    : entity.entity_type === 'service'
      ? t('entityPopover.service')
      : t('entityPopover.user')
  const statusSemantic = getEntityPresenceSemantic(entity, resolvedOnline)
  const statusLabel = getEntityStatusLabel(t, entity, resolvedOnline)
  const ownerLabel = useMemo(() => {
    if (!isBot) return null
    if (entity.owner_id && entity.owner_id === myEntity?.id) {
      return entityDisplayName(myEntity)
    }
    const metadataOwnerName = entity.metadata?.owner_name
    if (typeof metadataOwnerName === 'string' && metadataOwnerName.trim().length > 0) {
      return metadataOwnerName.trim()
    }
    return entity.owner_id ? `#${entity.owner_id}` : '--'
  }, [entity.metadata, entity.owner_id, isBot, myEntity])
  const lastSeenLabel = useMemo(() => {
    if (!lastSeen) return null
    const relative = formatRelativeLastSeen(lastSeen, i18n.language)
    const absolute = new Date(lastSeen).toLocaleString(i18n.language)
    return `${relative} · ${absolute}`
  }, [i18n.language, lastSeen])

  useEffect(() => {
    setResolvedOnline(isOnline)
    setLastSeen(null)
  }, [isOnline, entity.id])

  useEffect(() => {
    if (!token || !entity.id) return
    let cancelled = false
    api.getEntityStatus(token, entity.id).then((res) => {
      if (cancelled || !res.ok || !res.data) return
      setResolvedOnline(!!res.data.online)
      setLastSeen(res.data.last_seen || null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [token, entity.id])

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.backButton, pressed && { backgroundColor: colors.bgHover }]}>
          <ArrowLeft size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {t('entityPopover.viewDetails')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <EntityAvatar entity={entity} size="lg" showStatus isOnline={resolvedOnline} />
          <View style={styles.heroText}>
            <View style={styles.titleRow}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {entityDisplayName(entity)}
              </Text>
              <View style={[styles.typeBadge, { backgroundColor: isBot ? colors.accentDim : colors.bgHover }]}>
                {isBot ? <Bot size={12} color={colors.accent} /> : <User size={12} color={colors.textSecondary} />}
                <Text style={[styles.typeBadgeText, { color: isBot ? colors.accent : colors.textSecondary }]}>
                  {typeLabel}
                </Text>
              </View>
            </View>
            <Text style={[styles.handle, { color: colors.textMuted }]}>@{entity.name}</Text>
            <View style={styles.statusRow}>
              {statusSemantic === 'disabled' ? (
                <PowerOff size={12} color={colors.warning} />
              ) : statusSemantic === 'pending' ? (
                <Clock size={12} color={colors.warning} />
              ) : statusSemantic === 'online' ? (
                <Wifi size={12} color={colors.success} />
              ) : (
                <WifiOff size={12} color={colors.textMuted} />
              )}
              <Text
                style={[
                  styles.statusText,
                  {
                    color: statusSemantic === 'disabled' || statusSemantic === 'pending'
                      ? colors.warning
                      : statusSemantic === 'online'
                        ? colors.success
                        : colors.textMuted,
                  },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        {description ? (
          <View style={[styles.section, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <InfoRow label={t('entityPopover.type')} value={typeLabel} colors={colors} />
          {ownerLabel ? <InfoRow label={t('bot.owner')} value={ownerLabel} colors={colors} /> : null}
          <InfoRow label="ID" value={`#${entity.id}`} colors={colors} />
          {!resolvedOnline && lastSeenLabel ? (
            <InfoRow
              label={t('bot.lastSeen')}
              value={lastSeenLabel}
              colors={colors}
              icon={<Clock size={14} color={colors.textMuted} />}
            />
          ) : null}
        </View>

        {tags.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('entityPopover.tags')}</Text>
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <View key={tag} style={[styles.tagChip, { backgroundColor: colors.accentDim }]}>
                  <Text style={[styles.tagText, { color: colors.accent }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {isBot && (
          <View style={[styles.section, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('bot.capabilityTitle')}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{capabilitySummary}</Text>
            <View style={[styles.tagsRow, { marginTop: 10 }]}>
              {capabilityChips.map((chip) => (
                <View key={chip} style={[styles.tagChip, { backgroundColor: colors.bgHover }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>{chip}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        {onStartChat ? (
          <Pressable
            onPress={() => onStartChat(entity)}
            style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.accent }, pressed && styles.actionPressed]}
          >
            <MessageSquare size={14} color="#ffffff" />
            <Text style={styles.primaryActionText}>{t('entityPopover.sendMessage')}</Text>
          </Pressable>
        ) : null}
        {canViewDetails && onViewDetails ? (
          <Pressable
            onPress={() => onViewDetails(entity)}
            style={({ pressed }) => [styles.secondaryAction, { backgroundColor: colors.bgHover }, pressed && styles.actionPressed]}
          >
            <ExternalLink size={14} color={colors.textSecondary} />
            <Text style={[styles.secondaryActionText, { color: colors.textSecondary }]}>{t('entityPopover.viewDetails')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

function InfoRow({
  label,
  value,
  colors,
  icon,
}: {
  label: string
  value: string
  colors: ReturnType<typeof useThemeColors>
  icon?: React.ReactNode
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelRow}>
        {icon}
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  heroCard: {
    flexDirection: 'row',
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 16,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  handle: {
    fontSize: 13,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionPressed: {
    opacity: 0.8,
  },
})
