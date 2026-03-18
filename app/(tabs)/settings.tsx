import { useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { SettingsScreen } from '../../src/components/settings/SettingsScreen'
import { useThemeColors } from '../../src/lib/theme'

export default function SettingsTab() {
  const router = useRouter()
  const colors = useThemeColors()

  const handleBack = useCallback(() => {
    router.push('/(tabs)/chat')
  }, [router])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <SettingsScreen onBack={handleBack} />
    </SafeAreaView>
  )
}
