import { useEffect, useState, useCallback } from 'react'
import { StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/store/auth'
import * as api from '../../src/lib/api'
import type { Entity } from '../../src/lib/types'
import { BotDetail } from '../../src/components/entity/BotDetail'

export default function BotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const botId = Number(id)
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [bot, setBot] = useState<Entity | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

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
    router.back()
  }, [router])

  const handleOpenConversation = useCallback((convId: number) => {
    router.push(`/chat/${convId}`)
  }, [router])

  const handleStartChat = useCallback(async (entityId: number) => {
    if (!token || !bot) return
    const displayName = bot.display_name || bot.name || 'Bot'
    const res = await api.createConversation(token, {
      title: displayName,
      conv_type: 'direct',
      participant_ids: [entityId],
    })
    if (res.ok && res.data) {
      router.push(`/chat/${res.data.id}`)
    }
  }, [token, bot, router])

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
