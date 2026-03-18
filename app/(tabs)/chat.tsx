import { useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ConversationList } from '../../src/components/conversation/ConversationList'
import { useAuthStore } from '../../src/store/auth'
import { useConversationsStore } from '../../src/store/conversations'
import * as api from '../../src/lib/api'

export default function ChatTab() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const setConversations = useConversationsStore((s) => s.setConversations)

  const loadConversations = useCallback(async () => {
    if (!token) return
    const res = await api.listConversations(token)
    if (res.ok && res.data) {
      const convs = Array.isArray(res.data) ? res.data : (res.data as any).conversations || []
      setConversations(convs)
    }
  }, [token, setConversations])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
      <ConversationList
        conversations={conversations || []}
        activeId={null}
        myEntityId={entity?.id || 0}
        onSelect={(id) => router.push(`/chat/${id}`)}
        onNewChat={() => {}}
        onRefresh={loadConversations}
      />
    </SafeAreaView>
  )
}
