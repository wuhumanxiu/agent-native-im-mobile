import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Send } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { useConversationsStore } from '../../src/store/conversations'
import * as api from '../../src/lib/api'
import type { Message } from '../../src/lib/types'
import { EntityAvatar } from '../../src/components/ui/EntityAvatar'

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const convId = Number(id)
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const entity = useAuthStore((s) => s.entity)
  const conversations = useConversationsStore((s) => s.conversations)
  const conversation = conversations.find((c) => c.id === convId)

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!token || !convId) return
    setLoading(true)
    api.listMessages(token, convId).then((res) => {
      if (res.ok && res.data) {
        const msgs = Array.isArray(res.data) ? res.data : (res.data as any).messages || []
        setMessages(msgs)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [token, convId])

  const handleSend = useCallback(async () => {
    if (!token || !text.trim() || sending) return
    setSending(true)
    await api.sendMessage(token, convId, { layers: { summary: text.trim() } })
    setText('')
    const res = await api.listMessages(token, convId)
    if (res.ok && res.data) {
      const msgs = Array.isArray(res.data) ? res.data : (res.data as any).messages || []
      setMessages(msgs)
    }
    setSending(false)
  }, [token, convId, text, sending])

  const title = conversation?.title || `Chat #${id}`

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isSelf = item.sender_id === entity?.id
    const senderName = item.sender?.display_name || item.sender?.name || '?'
    const content = item.layers?.summary || ''
    const isRevoked = !!item.revoked_at

    return (
      <View style={[styles.msgRow, isSelf && styles.msgRowSelf]}>
        {!isSelf && <EntityAvatar entity={item.sender} size="sm" />}
        <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
          {!isSelf && <Text style={styles.senderName}>{senderName}</Text>}
          <Text style={[styles.msgText, isRevoked && styles.revokedText]}>
            {isRevoked ? 'Message revoked' : content}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    )
  }, [entity?.id])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color="#1a1a2e" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#6366f1" /></View>
        ) : (
          <FlatList
            data={[...messages].reverse()}
            renderItem={renderMessage}
            keyExtractor={(m) => String(m.id)}
            inverted
            contentContainerStyle={styles.list}
          />
        )}

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, text.trim() ? styles.sendBtnActive : null]}
          >
            <Send size={18} color={text.trim() ? '#fff' : '#9ca3af'} />
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff',
  },
  backBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 12, paddingVertical: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 8, gap: 8, alignItems: 'flex-end' },
  msgRowSelf: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  bubbleSelf: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6366f1', marginBottom: 2 },
  msgText: { fontSize: 15, color: '#1a1a2e', lineHeight: 20 },
  revokedText: { fontStyle: 'italic', color: '#9ca3af' },
  timestamp: { fontSize: 10, color: '#9ca3af', marginTop: 4, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff',
  },
  input: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#1a1a2e', maxHeight: 100,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb',
  },
  sendBtnActive: { backgroundColor: '#6366f1' },
})
