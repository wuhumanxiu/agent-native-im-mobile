import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from '../src/store/auth'
import { useWebSocket } from '../src/hooks/useWebSocket'
import '../src/i18n'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const token = useAuthStore((s) => s.token)
  const navigationState = useRootNavigationState()

  // Connect WebSocket when authenticated
  useWebSocket()

  useEffect(() => {
    // Wait until navigation is ready before redirecting
    if (!navigationState?.key) return

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register'

    if (!token && !inAuthGroup) {
      router.replace('/login')
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/chat')
    }
  }, [token, segments, navigationState?.key])

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="bots/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="join/[code]" options={{ headerShown: true, title: 'Join' }} />
      </Stack>
    </SafeAreaProvider>
  )
}
