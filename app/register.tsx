import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { UserPlus, ArrowLeft } from 'lucide-react-native'
import { useAuthStore } from '../src/store/auth'
import * as api from '../src/lib/api'
import { applyGatewayUrl, clearGatewayUrl, getDefaultGatewayUrl, getGatewayUrl, persistGatewayUrl } from '../src/lib/gateway'

function getPasswordStrength(pwd: string, t: (k: string) => string) {
  if (pwd.length === 0) return { level: 0, text: '', color: 'transparent' }
  if (pwd.length < 6) return { level: 1, text: t('auth.pwdTooShort'), color: '#ef4444' }
  if (pwd.length < 8) return { level: 2, text: t('auth.pwdWeak'), color: '#f97316' }
  const hasUpper = /[A-Z]/.test(pwd)
  const hasLower = /[a-z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd)
  const strength = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (strength >= 3 && pwd.length >= 8) return { level: 4, text: t('auth.pwdStrong'), color: '#22c55e' }
  if (strength >= 2) return { level: 3, text: t('auth.pwdMedium'), color: '#eab308' }
  return { level: 2, text: t('auth.pwdWeak'), color: '#f97316' }
}

export default function RegisterScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGateway, setShowGateway] = useState(getGatewayUrl() !== getDefaultGatewayUrl())
  const [gateway, setGateway] = useState(getGatewayUrl())

  const pwdStrength = getPasswordStrength(password, t)
  const canSubmit =
    username.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword.length > 0 &&
    !loading

  const handleRegister = async () => {
    Keyboard.dismiss()
    setError(null)
    if (password.length < 6) {
      setError(t('settings.passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('settings.passwordMismatch'))
      return
    }
    setLoading(true)
    try {
      try {
        if (showGateway) {
          persistGatewayUrl(gateway)
        } else {
          applyGatewayUrl(getGatewayUrl())
        }
      } catch {
        setError(t('auth.gatewayInvalid'))
        return
      }
      const res = await api.register(
        username.trim(),
        password,
        email.trim() || undefined,
        displayName.trim() || undefined,
      )
      if (res.ok && res.data) {
        setAuth(res.data.token, res.data.entity)
      } else {
        const msg =
          typeof res.error === 'string'
            ? res.error
            : (res.error as { message?: string })?.message || 'Registration failed'
        setError(msg)
      }
    } catch {
      setError('Network error -- cannot reach server')
    } finally {
      setLoading(false)
    }
  }

  const clearErrors = () => {
    setError(null)
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('auth.register')}</Text>
            <Text style={styles.headerSubtitle}>{t('auth.joinTagline')}</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Username */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.username')} *</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(v) => { clearErrors(); setUsername(v) }}
                placeholder={t('auth.chooseUsername')}
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => { clearErrors(); setEmail(v) }}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Display Name */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.displayName')}</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={(v) => { clearErrors(); setDisplayName(v) }}
                placeholder={t('auth.displayNamePlaceholder')}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.password')} *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(v) => { clearErrors(); setPassword(v) }}
                placeholder={t('auth.passwordHint')}
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
              />
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthTrack}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${pwdStrength.level * 25}%`,
                          backgroundColor: pwdStrength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthText, { color: pwdStrength.color }]}>
                    {pwdStrength.text}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('settings.confirmPassword')} *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(v) => { clearErrors(); setConfirmPassword(v) }}
                placeholder={t('auth.reenterPassword')}
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleRegister}
              />
            </View>

            <View style={styles.gatewaySection}>
              <TouchableOpacity
                onPress={() => {
                  clearErrors()
                  setShowGateway((prev) => !prev)
                }}
              >
                <Text style={styles.gatewayToggleText}>
                  {showGateway ? t('auth.hideGateway') : t('auth.useCustomGateway')}
                </Text>
              </TouchableOpacity>
              {showGateway ? (
                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.gateway')}</Text>
                  <TextInput
                    style={styles.input}
                    value={gateway}
                    onChangeText={(v) => { clearErrors(); setGateway(v) }}
                    placeholder={getDefaultGatewayUrl()}
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.gatewayHelp}>{t('auth.gatewayHelp')}</Text>
                  {gateway !== getDefaultGatewayUrl() ? (
                    <TouchableOpacity
                      onPress={() => {
                        clearGatewayUrl()
                        setGateway(getDefaultGatewayUrl())
                        clearErrors()
                      }}
                    >
                      <Text style={styles.gatewayToggleText}>{t('auth.useOfficialGateway')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <UserPlus size={16} color="#ffffff" />
                  <Text style={styles.buttonText}>{t('auth.register')}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={16} color="#9ca3af" />
              <Text style={styles.backText}>{t('auth.backToLogin')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>Powered by ANIMP Protocol</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  container: {
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#1a1a2e',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  gatewaySection: {
    gap: 8,
  },
  gatewayToggleText: {
    fontSize: 12,
    color: '#6b7280',
  },
  gatewayHelp: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#1a1a2e',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 11,
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
    height: 40,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    gap: 8,
  },
  backText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 24,
  },
})
