import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ConversationListScreen } from '../screens/chats/ConversationListScreen'
import { ChatScreen } from '../screens/chats/ChatScreen'
import { ChatSettingsScreen } from '../screens/chats/ChatSettingsScreen'

export type ChatsStackParamList = {
  ConversationList: undefined
  Chat: { conversationId: number }
  ChatSettings: { conversationId: number }
}

const Stack = createNativeStackNavigator<ChatsStackParamList>()

export function ChatsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ConversationList" component={ConversationListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
    </Stack.Navigator>
  )
}
