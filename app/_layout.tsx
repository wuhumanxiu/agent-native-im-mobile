import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import * as Updates from 'expo-updates'
import { useAuthStore } from '../src/store/auth'
import { useSettingsStore } from '../src/store/settings'
import { WebSocketProvider } from '../src/hooks/WebSocketContext'
import { useOfflineSync } from '../src/hooks/useOfflineSync'
import { setSessionHooks } from '../src/lib/auth-session'
import { useThemeColors } from '../src/lib/theme'
import { applyGatewayUrl } from '../src/lib/gateway'
import { extractNotificationTarget, registerNativePush } from '../src/lib/push'
import '../src/i18n'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const token = useAuthStore((s) => s.token)
  const sessionChecked = useAuthStore((s) => s.sessionChecked)
  const hydrateAuth = useAuthStore((s) => s.hydrate)
  const setToken = useAuthStore((s) => s.setToken)
  const logout = useAuthStore((s) => s.logout)
  const [isReady, setIsReady] = useState(false)
  const colors = useThemeColors()
  const pushEnabled = useSettingsStore((s) => s.pushEnabled)

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
    if (__DEV__) return
    let cancelled = false

    const syncUpdate = async () => {
      try {
        const result = await Updates.checkForUpdateAsync()
        if (!result.isAvailable || cancelled) return
        await Updates.fetchUpdateAsync()
        if (cancelled) return
        await Updates.reloadAsync()
      } catch {
        // Best-effort OTA sync. If the update check fails we keep using the
        // currently embedded/runtime-compatible bundle without blocking launch.
      }
    }

    void syncUpdate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSessionHooks({
      getToken: () => useAuthStore.getState().token,
      setToken: (nextToken: string) => setToken(nextToken),
      onAuthFailure: () => logout(),
    })
  }, [setToken, logout])

  useEffect(() => {
    if (!isReady || !sessionChecked) return

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register'

    if (!token && !inAuthGroup) {
      router.replace('/login')
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/chat')
    }
  }, [token, segments, isReady, sessionChecked])

  useEffect(() => {
    if (!token || !pushEnabled) return
    void registerNativePush(token)
  }, [token, pushEnabled])

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = extractNotificationTarget(response.notification.request.content.data as Record<string, unknown>)
      if (target) {
        router.push(target as never)
      }
    })
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return
      const target = extractNotificationTarget(response.notification.request.content.data as Record<string, unknown>)
      if (target) {
        router.push(target as never)
      }
    })
    return () => {
      responseSubscription.remove()
    }
  }, [router])

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
