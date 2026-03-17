import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/auth'

export default function Index() {
  const token = useAuthStore((s) => s.token)

  if (!token) {
    return <Redirect href="/login" />
  }

  return <Redirect href="/(tabs)/chat" />
}
