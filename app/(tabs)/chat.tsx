import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ConversationList } from '../../src/components/conversation/ConversationList'
import { NewConversation } from '../../src/components/conversation/NewConversation'
import { GlobalSearch } from '../../src/components/conversation/GlobalSearch'
import { useAuthStore } from '../../src/store/auth'
import { useConversationsStore } from '../../src/store/conversations'
import { useThemeColors } from '../../src/lib/theme'
import * as api from '../../src/lib/api'

export default function ChatTab() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const setConversations = useConversationsStore((s) => s.setConversations)
  const toggleMute = useConversationsStore((s) => s.toggleMute)
  const isMuted = useConversationsStore((s) => s.isMuted)
  const removeConversation = useConversationsStore((s) => s.removeConversation)

  const colors = useThemeColors()
  const [showNewChat, setShowNewChat] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

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

  const handleNewChatCreated = useCallback((convId: number) => {
    setShowNewChat(false)
    loadConversations()
    router.push(`/chat/${convId}`)
  }, [router, loadConversations])

  const handleSearchResult = useCallback((conversationId: number, _messageId: number) => {
    setShowSearch(false)
    router.push(`/chat/${conversationId}`)
  }, [router])

  const handlePin = useCallback(async (convId: number) => {
    if (!token) return
    await api.pinConversation(token, convId)
    loadConversations()
  }, [token, loadConversations])

  const handleUnpin = useCallback(async (convId: number) => {
    if (!token) return
    await api.unpinConversation(token, convId)
    loadConversations()
  }, [token, loadConversations])

  const handleArchive = useCallback(async (convId: number) => {
    if (!token) return
    await api.archiveConversation(token, convId)
    removeConversation(convId)
  }, [token, removeConversation])

  const handleLeave = useCallback(async (convId: number) => {
    if (!token) return
    await api.leaveConversation(token, convId)
    removeConversation(convId)
  }, [token, removeConversation])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ConversationList
        conversations={conversations || []}
        activeId={null}
        myEntityId={entity?.id || 0}
        onSelect={(id) => router.push(`/chat/${id}`)}
        onNewChat={() => setShowNewChat(true)}
        onRefresh={loadConversations}
        onToggleMute={(id) => toggleMute(id)}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onArchive={handleArchive}
        onLeave={handleLeave}
        isMuted={(id) => isMuted(id)}
      />

      {/* New Conversation Modal */}
      <NewConversation
        visible={showNewChat}
        onClose={() => setShowNewChat(false)}
        onCreated={handleNewChatCreated}
      />

      {/* Global Search Modal */}
      <GlobalSearch
        visible={showSearch}
        onSelectResult={handleSearchResult}
        onClose={() => setShowSearch(false)}
      />
    </SafeAreaView>
  )
}
