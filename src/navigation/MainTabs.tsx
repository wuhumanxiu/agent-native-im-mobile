import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeContext'
import { useConversationsStore } from '../store/conversations'
import { ChatsStack } from './ChatsStack'
import { BotsStack } from './BotsStack'
import { SettingsScreen } from '../screens/settings/SettingsScreen'

export type MainTabParamList = {
  ChatsTab: undefined
  BotsTab: undefined
  SettingsTab: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

function ChatIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size * 0.75,
        height: size * 0.6,
        borderRadius: size * 0.15,
        borderWidth: 2,
        borderColor: color,
      }} />
      <View style={{
        width: 0,
        height: 0,
        borderLeftWidth: size * 0.15,
        borderBottomWidth: size * 0.15,
        borderLeftColor: color,
        borderBottomColor: 'transparent',
        position: 'absolute',
        bottom: size * 0.1,
        left: size * 0.15,
      }} />
    </View>
  )
}

function BotIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size * 0.6,
        height: size * 0.5,
        borderRadius: size * 0.12,
        borderWidth: 2,
        borderColor: color,
      }} />
      <View style={{
        width: size * 0.15,
        height: size * 0.2,
        backgroundColor: color,
        position: 'absolute',
        top: size * 0.05,
        left: size * 0.25,
        borderRadius: 2,
      }} />
      <View style={{
        width: size * 0.15,
        height: size * 0.2,
        backgroundColor: color,
        position: 'absolute',
        top: size * 0.05,
        right: size * 0.25,
        borderRadius: 2,
      }} />
    </View>
  )
}

function GearIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size * 0.55,
        height: size * 0.55,
        borderRadius: size * 0.275,
        borderWidth: 2,
        borderColor: color,
      }} />
      <View style={{
        width: size * 0.2,
        height: size * 0.2,
        borderRadius: size * 0.1,
        backgroundColor: color,
        position: 'absolute',
      }} />
    </View>
  )
}

export function MainTabs() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const conversations = useConversationsStore((s) => s.conversations)
  const mutedIds = useConversationsStore((s) => s.mutedIds)

  const totalUnread = conversations.reduce((sum, c) => {
    if (mutedIds.has(c.id)) return sum
    return sum + (c.unread_count || 0)
  }, 0)

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="ChatsTab"
        component={ChatsStack}
        options={{
          tabBarLabel: t('conversation.messages'),
          tabBarIcon: ({ color, size }) => <ChatIcon color={color} size={size} />,
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
          },
        }}
      />
      <Tab.Screen
        name="BotsTab"
        component={BotsStack}
        options={{
          tabBarLabel: t('bot.agents'),
          tabBarIcon: ({ color, size }) => <BotIcon color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('settings.title'),
          tabBarIcon: ({ color, size }) => <GearIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  )
}
