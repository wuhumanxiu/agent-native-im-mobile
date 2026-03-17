import { useEffect, useState } from 'react'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/store/auth'
import * as api from '../../src/lib/api'
import type { Conversation } from '../../src/lib/types'
import { ChatThread } from '../../src/components/chat/ChatThread'

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [conversation, setConversation] = useState<Conversation | null>(null)

  useEffect(() => {
    if (!token || !id) return
    api.listConversations(token).then((res) => {
      if (res.ok && res.data) {
        const convs = Array.isArray(res.data) ? res.data : (res.data as any).conversations || []
        const conv = convs.find((c: Conversation) => c.id === Number(id))
        if (conv) setConversation(conv)
      }
    })
  }, [token, id])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['bottom']}>
        {conversation ? (
          <ChatThread
            conversation={conversation}
            onBack={() => router.back()}
          />
        ) : null}
      </SafeAreaView>
    </>
  )
}
