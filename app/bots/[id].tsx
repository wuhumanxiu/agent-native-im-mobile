import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function BotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useTranslation()

  // TODO: fetch bot details and render BotDetail component
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `${t('bot.agentDetails')}`,
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#1a1a2e',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <Text style={styles.placeholder}>Bot #{id}</Text>
          <Text style={styles.hint}>{t('bot.agentDetails')}</Text>
        </View>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholder: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#9ca3af',
  },
})
