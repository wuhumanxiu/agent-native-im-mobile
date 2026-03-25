import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from '../src/store/auth'
import { useSettingsStore } from '../src/store/settings'
import { WebSocketProvider } from '../src/hooks/WebSocketContext'
import { useOfflineSync } from '../src/hooks/useOfflineSync'
import { useThemeColors } from '../src/lib/theme'
import { applyGatewayUrl } from '../src/lib/gateway'
import '../src/i18n'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const token = useAuthStore((s) => s.token)
  const sessionChecked = useAuthStore((s) => s.sessionChecked)
  const hydrateAuth = useAuthStore((s) => s.hydrate)
  const [isReady, setIsReady] = useState(false)
  const colors = useThemeColors()

  useOfflineSync()

  // Mark ready after navigator is fully mounted (next frame)
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    hydrateAuth().then(() => {
      applyGatewayUrl()
    }).catch(() => {
      applyGatewayUrl()
    })
  }, [hydrateAuth])

  useEffect(() => {
    if (!isReady || !sessionChecked) return

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register'

    if (!token && !inAuthGroup) {
      router.replace('/login')
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/chat')
    }
  }, [token, segments, isReady, sessionChecked])

  return (
    <SafeAreaProvider>
      <WebSocketProvider>
        <StatusBar style={colors.statusBar} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="bots/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="join/[code]" options={{ headerShown: true, title: 'Join' }} />
        </Stack>
      </WebSocketProvider>
    </SafeAreaProvider>
  )
}
