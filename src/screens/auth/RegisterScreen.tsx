import React, { useState, useCallback } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

type Props = NativeStackScreenProps<{ Login: undefined; Register: undefined }, 'Register'>

export function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setError(t('auth.fieldsRequired'))
      return
    }
    if (password.length < 6) {
      setError(t('auth.passwordHint'))
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.register(
        username.trim(),
        password,
        email.trim() || undefined,
        displayName.trim() || undefined,
      )
      if (res.ok && res.data) {
        setAuth(res.data.token, res.data.entity)
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : (res.error as { message?: string })?.message || t('auth.registerError')
        setError(errMsg)
      }
    } catch {
      setError(t('auth.networkError'))
    } finally {
      setLoading(false)
    }
  }, [username, password, email, displayName, setAuth, t])

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
              <Text style={styles.logoText}>AI</Text>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('auth.joinTagline')}
            </Text>
          </View>

          <View style={styles.form}>
            {error.length > 0 && (
              <View style={[styles.errorBox, { backgroundColor: colors.error + '20' }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder={t('auth.chooseUsername')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('auth.displayNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
              editable={!loading}
            />

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.enterPassword')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
              secureTextEntry
              editable={!loading}
            />
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('auth.passwordHint')}</Text>

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.accent,
                  opacity: pressed || loading ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.register')}</Text>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.textMuted }]}>
                {t('auth.haveAccount')}{' '}
              </Text>
              <Pressable onPress={() => navigation.goBack()}>
                <Text style={[styles.switchLink, { color: colors.accent }]}>
                  {t('auth.signIn')}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  form: {
    gap: 12,
  },
  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    fontSize: 12,
    marginTop: -6,
    marginLeft: 4,
  },
  button: {
    height: 50,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '600',
  },
})
