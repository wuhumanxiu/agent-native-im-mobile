import React, { createContext, useContext, useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuthStore } from '../store/auth'
import { useConversationsStore } from '../store/conversations'
import { useTheme } from '../theme/ThemeContext'
import { useWebSocket, type TypingMap } from '../hooks/useWebSocket'
import { AuthStack } from './AuthStack'
import { MainTabs } from './MainTabs'
import { ConnectionStatusBar } from '../components/ui/ConnectionStatusBar'

// ─── WebSocket context (shared across all screens) ──────────────────
interface WSContextType {
  sendTyping: (conversationId: number) => void
  sendCancelStream: (streamId: string, conversationId: number) => void
  typingMap: TypingMap
  wsConnected: boolean
}

const WSContext = createContext<WSContextType>({
  sendTyping: () => {},
  sendCancelStream: () => {},
  typingMap: new Map(),
  wsConnected: false,
})

export function useWSContext() {
  return useContext(WSContext)
}

function AuthenticatedApp() {
  const { sendTyping, sendCancelStream, typingMap, wsConnected } = useWebSocket()

  // Hydrate muted IDs
  const hydrateMuted = useConversationsStore((s) => s.hydrateMuted)
  useEffect(() => {
    hydrateMuted()
  }, [hydrateMuted])

  return (
    <WSContext.Provider value={{ sendTyping, sendCancelStream, typingMap, wsConnected }}>
      <ConnectionStatusBar />
      <MainTabs />
    </WSContext.Provider>
  )
}

export function RootNavigator() {
  const { colors } = useTheme()
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s.hydrated)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!token) {
    return <AuthStack />
  }

  return <AuthenticatedApp />
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
