import { Tabs } from 'expo-router'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Bot, Settings2, Users, Bell } from 'lucide-react-native'
import { AppState, View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '../../src/lib/theme'
import { useConversationsStore } from '../../src/store/conversations'
import { useAuthStore } from '../../src/store/auth'
import { useNotificationsStore } from '../../src/store/notifications'
import * as api from '../../src/lib/api'

function TabBarIcon({
  Icon,
  color,
  badge,
}: {
  Icon: typeof MessageSquare
  color: string
  badge?: number
}) {
  return (
    <View style={tabIconStyles.wrapper}>
      <Icon size={22} color={color} />
      {badge != null && badge > 0 && (
        <View style={tabIconStyles.badge}>
          <Text style={tabIconStyles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </View>
  )
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
})

export default function TabLayout() {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const token = useAuthStore((s) => s.token)
  const sessionChecked = useAuthStore((s) => s.sessionChecked)
  const conversations = useConversationsStore((s) => s.conversations)
  const mutedIds = useConversationsStore((s) => s.mutedIds)
  const inboxUnreadCount = useNotificationsStore((s) => s.unreadCount)
  const friendRequestCount = useNotificationsStore((s) => s.friendRequestCount)
  const hydrateSnapshot = useNotificationsStore((s) => s.hydrateSnapshot)
  const markDirty = useNotificationsStore((s) => s.markDirty)
  const messageUnreadCount = conversations.reduce((sum, c) => {
    if (mutedIds.has(c.id)) return sum
    return sum + (c.unread_count || 0)
  }, 0)

  const loadInboxSnapshot = useCallback(async () => {
    if (!sessionChecked || !token) return
    const res = await api.getInboxSnapshot(token)
    if (res.ok && res.data) {
      hydrateSnapshot({
        trackedEntityIds: res.data.tracked_entity_ids,
        actingEntities: res.data.acting_entities,
        notifications: res.data.notifications,
        pendingFriendRequests: res.data.pending_friend_requests,
      })
    }
  }, [hydrateSnapshot, sessionChecked, token])

  useEffect(() => {
    void loadInboxSnapshot()
  }, [loadInboxSnapshot])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        markDirty()
        void loadInboxSnapshot()
      }
    })
    return () => sub.remove()
  }, [loadInboxSnapshot, markDirty])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: t('conversation.messages'),
          tabBarIcon: ({ color }) => (
            <TabBarIcon Icon={MessageSquare} color={color} badge={messageUnreadCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t('friends.title'),
          tabBarIcon: ({ color }) => (
            <TabBarIcon Icon={Users} color={color} badge={friendRequestCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t('inbox.title'),
          tabBarIcon: ({ color }) => (
            <TabBarIcon Icon={Bell} color={color} badge={inboxUnreadCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="bots"
        options={{
          title: t('bot.agents'),
          tabBarIcon: ({ color }) => <TabBarIcon Icon={Bot} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color }) => <TabBarIcon Icon={Settings2} color={color} />,
        }}
      />
    </Tabs>
  )
}
