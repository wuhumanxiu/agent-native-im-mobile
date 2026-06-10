import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useThemeColors } from '../src/lib/theme'
import { useAuthStore } from '../src/store/auth'

export default function Index() {
  const token = useAuthStore((s) => s.token)
  const sessionChecked = useAuthStore((s) => s.sessionChecked)
  const colors = useThemeColors()

  if (!sessionChecked) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (!token) {
    return <Redirect href="/login" />
  }

  return <Redirect href="/(tabs)/chat" />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
