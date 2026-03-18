import { useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { SettingsScreen } from '../../src/components/settings/SettingsScreen'

export default function SettingsTab() {
  const router = useRouter()

  // In a tab context, "back" navigates to the chat tab
  const handleBack = useCallback(() => {
    router.push('/(tabs)/chat')
  }, [router])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
      <SettingsScreen onBack={handleBack} />
    </SafeAreaView>
  )
}
