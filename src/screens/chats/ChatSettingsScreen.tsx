import React from 'react'
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../theme/ThemeContext'
import { useConversationsStore } from '../../store/conversations'
import { useAuthStore } from '../../store/auth'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { entityDisplayName, isBotOrService } from '../../lib/utils'
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
  const conv = useConversationsStore((s) => s.conversations.find((c) => c.id === conversationId))
  const entity = useAuthStore((s) => s.entity)

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
            {isSelf && <Text style={{ color: colors.textMuted }}> (you)</Text>}
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
