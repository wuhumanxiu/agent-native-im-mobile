import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ConversationList } from '../../src/components/conversation/ConversationList'

export default function ChatTab() {
  const router = useRouter()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
      <ConversationList
        onSelect={(id) => router.push(`/chat/${id}`)}
        onNewChat={() => {}}
      />
    </SafeAreaView>
  )
}
