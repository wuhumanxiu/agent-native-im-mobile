import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/auth'

export default function Index() {
  const token = useAuthStore((s) => s.token)
  const sessionChecked = useAuthStore((s) => s.sessionChecked)

  if (!sessionChecked) {
    return null
  }

  if (!token) {
    return <Redirect href="/login" />
  }

  return <Redirect href="/(tabs)/chat" />
}
