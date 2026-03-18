import { useState, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/store/auth'
import * as api from '../../src/lib/api'
import { BotList } from '../../src/components/entity/BotList'
import { CreateBotDialog } from '../../src/components/entity/CreateBotDialog'
import type { Entity } from '../../src/lib/types'

export default function BotsTab() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [createdResult, setCreatedResult] = useState<{ entity: Entity; key: string; doc: string } | null>(null)

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id)
    router.push(`/bots/${id}`)
  }, [router])

  const handleStartChat = useCallback(async (entityId: number) => {
    if (!token) return
    // Get entity name for chat title
    const res = await api.listEntities(token)
    let name = 'Bot'
    if (res.ok && res.data) {
      const entities = Array.isArray(res.data) ? res.data : []
      const found = entities.find((e) => e.id === entityId)
      if (found) name = found.display_name || found.name || 'Bot'
    }
    const convRes = await api.createConversation(token, {
      title: name,
      conv_type: 'direct',
      participant_ids: [entityId],
    })
    if (convRes.ok && convRes.data) {
      router.push(`/chat/${convRes.data.id}`)
    }
  }, [token, router])

  const handleCreated = useCallback((result: { entity: Entity; key: string; doc: string }) => {
    setCreatedResult(result)
    setShowCreate(false)
    setRefreshTrigger((v) => v + 1)
    // Navigate to the newly created bot
    router.push(`/bots/${result.entity.id}`)
  }, [router])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
      <BotList
        selectedId={selectedId}
        onSelect={handleSelect}
        onCreatePress={() => setShowCreate(true)}
        onCreated={handleCreated}
        refreshTrigger={refreshTrigger}
      />
      <CreateBotDialog
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </SafeAreaView>
  )
}
