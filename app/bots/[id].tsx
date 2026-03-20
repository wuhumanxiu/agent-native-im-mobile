import { useEffect, useState, useCallback } from 'react'
import { StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/store/auth'
import * as api from '../../src/lib/api'
import type { Entity } from '../../src/lib/types'
import { BotDetail } from '../../src/components/entity/BotDetail'
import { NewConversation } from '../../src/components/conversation/NewConversation'

export default function BotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const botId = Number(id)
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [bot, setBot] = useState<Entity | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [showNewChat, setShowNewChat] = useState(false)

  useEffect(() => {
    if (!token || !botId) return
    let cancelled = false
    api.listEntities(token).then((res) => {
      if (cancelled) return
      if (res.ok && res.data) {
        const entities = Array.isArray(res.data) ? res.data : []
        const found = entities.find((e) => e.id === botId)
        if (found) setBot(found)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [token, botId, refreshTrigger])

  const handleBack = useCallback(() => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/bots')
  }, [router])

  const handleOpenConversation = useCallback((convId: number) => {
    router.push(`/chat/${convId}`)
  }, [router])

  const handleStartChat = useCallback(async (_entityId: number) => {
    setShowNewChat(true)
  }, [])

  const handleDisable = useCallback(async (entityId: number) => {
    if (!token) return
    await api.deleteEntity(token, entityId)
    setRefreshTrigger((v) => v + 1)
  }, [token])

  const handleReactivate = useCallback(async (entityId: number) => {
    if (!token) return
    await api.reactivateEntity(token, entityId)
    setRefreshTrigger((v) => v + 1)
  }, [token])

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((v) => v + 1)
  }, [])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BotDetail
          bot={bot}
          onBack={handleBack}
          onOpenConversation={handleOpenConversation}
          onStartChat={handleStartChat}
          onDisable={handleDisable}
          onReactivate={handleReactivate}
          onRefresh={handleRefresh}
        />
        <NewConversation
          visible={showNewChat}
          preselectedEntityId={bot?.id}
          onClose={() => setShowNewChat(false)}
          onCreated={(convId) => {
            setShowNewChat(false)
            router.push(`/chat/${convId}?backTo=list`)
          }}
        />
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
})
