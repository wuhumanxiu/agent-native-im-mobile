import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../src/store/auth'
import * as api from '../../src/lib/api'

export default function JoinInviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const { t } = useTranslation()
  const router = useRouter()
  const token = useAuthStore((s) => s.token)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleJoin = async () => {
    if (!token) {
      router.replace('/login')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.joinViaInvite(token, code!)
      if (res.ok) {
        setSuccess(true)
        const data = res.data as { conversation_id?: number } | undefined
        if (data?.conversation_id) {
          setTimeout(() => router.replace(`/chat/${data.conversation_id}`), 500)
        }
      } else {
        const msg =
          typeof res.error === 'string'
            ? res.error
            : (res.error as { message?: string })?.message || t('invite.joinFailed')
        setError(msg)
      }
    } catch {
      setError(t('auth.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('invite.join'),
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#1a1a2e',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('invite.invitedToJoin')}</Text>
          <Text style={styles.code}>{code}</Text>

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{t('invite.joinedSuccess')}</Text>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleJoin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>{t('invite.join')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  code: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  successBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  successText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
  },
  button: {
    height: 44,
    paddingHorizontal: 32,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
})
