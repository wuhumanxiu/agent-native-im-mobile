import { SafeAreaView } from 'react-native-safe-area-context'
import { SettingsScreen } from '../../src/components/settings/SettingsScreen'

export default function SettingsTab() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
      <SettingsScreen />
    </SafeAreaView>
  )
}
