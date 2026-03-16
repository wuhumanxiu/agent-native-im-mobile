import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuthStore } from '../store/auth'
import { useTheme } from '../theme/ThemeContext'
import { useWebSocket } from '../hooks/useWebSocket'
import { AuthStack } from './AuthStack'
import { MainTabs } from './MainTabs'

function AuthenticatedApp() {
  // Set up WebSocket when authenticated
  useWebSocket()
  return <MainTabs />
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
