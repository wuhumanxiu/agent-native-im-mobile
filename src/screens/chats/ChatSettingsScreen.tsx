import React, { useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { useConversationsStore } from '../../store/conversations'
import { useAuthStore } from '../../store/auth'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { entityDisplayName, isBotOrService } from '../../lib/utils'
import * as api from '../../lib/api'
import type { Participant } from '../../lib/types'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type ChatsStackParamList = {
  ConversationList: undefined
  Chat: { conversationId: number }
  ChatSettings: { conversationId: number }
}

type Props = NativeStackScreenProps<ChatsStackParamList, 'ChatSettings'>

export function ChatSettingsScreen({ route, navigation }: Props) {
  const { conversationId } = route.params
  const { colors } = useTheme()
  const { t } = useTranslation()
  const conv = useConversationsStore((s) => s.conversations.find((c) => c.id === conversationId))
  const { removeConversation, updateConversation, toggleMute, mutedIds } = useConversationsStore()
  const entity = useAuthStore((s) => s.entity)
  const token = useAuthStore((s) => s.token)

  const isPinned = !!conv?.participants?.find((p) => p.entity_id === entity?.id)?.pinned_at
  const isMuted = conv ? mutedIds.has(conv.id) : false

  const handleLeave = useCallback(() => {
    if (!token) return
    Alert.alert(t('conversation.leave'), t('conversation.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('conversation.leave'),
        style: 'destructive',
        onPress: async () => {
          const res = await api.leaveConversation(token, conversationId)
          if (res.ok) {
            removeConversation(conversationId)
            navigation.popToTop()
          }
        },
      },
    ])
  }, [token, conversationId, t, removeConversation, navigation])

  const handleArchive = useCallback(async () => {
    if (!token) return
    const res = await api.archiveConversation(token, conversationId)
    if (res.ok) {
      removeConversation(conversationId)
      navigation.popToTop()
    }
  }, [token, conversationId, removeConversation, navigation])

  const handleTogglePin = useCallback(async () => {
    if (!token || !entity || !conv) return
    if (isPinned) {
      const res = await api.unpinConversation(token, conversationId)
      if (res.ok) {
        updateConversation(conversationId, {
          participants: conv.participants?.map((p) =>
            p.entity_id === entity.id ? { ...p, pinned_at: undefined } : p
          ),
        })
      }
    } else {
      const res = await api.pinConversation(token, conversationId)
      if (res.ok) {
        updateConversation(conversationId, {
          participants: conv.participants?.map((p) =>
            p.entity_id === entity.id ? { ...p, pinned_at: new Date().toISOString() } : p
          ),
        })
      }
    }
  }, [token, entity, conv, isPinned, conversationId, updateConversation])

  const handleToggleMute = useCallback(() => {
    if (conv) toggleMute(conv.id)
  }, [conv, toggleMute])

  if (!conv) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]}>
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>
          Conversation not found
        </Text>
      </SafeAreaView>
    )
  }

  const participants = conv.participants || []

  const renderParticipant = ({ item }: { item: Participant }) => {
    const isSelf = item.entity_id === entity?.id
    const isBot = isBotOrService(item.entity)
    return (
      <View style={styles.participantRow}>
        <EntityAvatar entity={item.entity} size="md" showOnline />
        <View style={styles.participantInfo}>
          <Text style={[styles.participantName, { color: colors.textPrimary }]}>
            {entityDisplayName(item.entity)}
            {isSelf && <Text style={{ color: colors.textMuted }}> {t('common.you')}</Text>}
          </Text>
          <Text style={[styles.participantRole, { color: isBot ? colors.bot : colors.textMuted }]}>
            {isBot ? item.entity?.entity_type : item.role}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <Text style={[styles.backArrow, { color: colors.accent }]}>{'<'}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Chat Info</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Title */}
      <View style={[styles.infoSection, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Name</Text>
        <Text style={[styles.value, { color: colors.textPrimary }]}>{conv.title || 'Untitled'}</Text>

        {conv.description ? (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>Description</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>{conv.description}</Text>
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.textMuted, marginTop: 16 }]}>Type</Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>{conv.conv_type}</Text>
      </View>

      {/* Actions */}
      <View style={[styles.actionsSection, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleTogglePin} style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.actionText, { color: colors.accent }]}>
            {isPinned ? t('conversation.unpin') : t('conversation.pin')}
          </Text>
        </Pressable>
        <Pressable onPress={handleToggleMute} style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.actionText, { color: colors.accent }]}>
            {isMuted ? t('conversation.unmute') : t('conversation.mute')}
          </Text>
        </Pressable>
        <Pressable onPress={handleArchive} style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.actionText, { color: colors.warning }]}>
            {t('conversation.archive')}
          </Text>
        </Pressable>
        <Pressable onPress={handleLeave} style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.actionText, { color: colors.error }]}>
            {t('conversation.leave')}
          </Text>
        </Pressable>
      </View>

      {/* Members */}
      <View style={styles.membersHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Members ({participants.length})
        </Text>
      </View>
      <FlatList
        data={participants}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderParticipant}
        contentContainerStyle={styles.membersList}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  infoSection: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
  },
  actionsSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  membersHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  membersList: {
    paddingHorizontal: 16,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '500',
  },
  participantRole: {
    fontSize: 12,
    marginTop: 2,
  },
})
