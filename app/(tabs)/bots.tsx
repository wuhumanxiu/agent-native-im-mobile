import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BotList } from '../../src/components/entity/BotList'

export default function BotsTab() {
  const router = useRouter()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
      <BotList
        onSelect={(id) => router.push(`/bots/${id}`)}
        onStartChat={() => {}}
      />
    </SafeAreaView>
  )
}
