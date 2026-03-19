import React, { useMemo } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, ExternalLink, MessageSquare, User, Wifi, WifiOff } from 'lucide-react-native'
import { EntityAvatar } from '../ui/EntityAvatar'
import { useThemeColors } from '../../lib/theme'
import type { Entity } from '../../lib/types'

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

export function EntityQuickSheet({
  entity,
  isOnline,
  canViewDetails = false,
  onClose,
  onStartChat,
  onViewDetails,
}: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const isBot = isBotOrService(entity)
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
  const statusLabel = entity.status === 'disabled'
    ? t('entityPopover.disabled')
    : entity.status === 'pending'
      ? t('entityPopover.pending')
      : t('entityPopover.active')

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
          <EntityAvatar entity={entity} size="lg" showStatus isOnline={isOnline} />
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
              {isOnline ? <Wifi size={12} color="#16a34a" /> : <WifiOff size={12} color={colors.textMuted} />}
              <Text style={[styles.statusText, { color: isOnline ? '#16a34a' : colors.textMuted }]}>
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
          <InfoRow label={t('bot.owner')} value={entity.owner_id ? `#${entity.owner_id}` : '--'} colors={colors} />
          <InfoRow label="ID" value={`#${entity.id}`} colors={colors} />
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
}: {
  label: string
  value: string
  colors: ReturnType<typeof useThemeColors>
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
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
