import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { BotListScreen } from '../screens/bots/BotListScreen'
import { BotDetailScreen } from '../screens/bots/BotDetailScreen'

export type BotsStackParamList = {
  BotList: undefined
  BotDetail: { botId: number }
}

const Stack = createNativeStackNavigator<BotsStackParamList>()

export function BotsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="BotList" component={BotListScreen} />
      <Stack.Screen name="BotDetail" component={BotDetailScreen} />
    </Stack.Navigator>
  )
}
