import { useEffect, useState } from 'react'
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
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { LogIn, Eye, EyeOff } from 'lucide-react-native'
import { useAuthStore } from '../src/store/auth'
import * as api from '../src/lib/api'
import { applyGatewayUrl, clearGatewayUrl, getDefaultGatewayUrl, getGatewayUrl, persistGatewayUrl } from '../src/lib/gateway'

export default function LoginScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [showGateway, setShowGateway] = useState(getGatewayUrl() !== getDefaultGatewayUrl())
  const [gateway, setGateway] = useState(getGatewayUrl())

  useEffect(() => {
    let cancelled = false
    api.getVapidKey().then((res) => {
      if (!cancelled) setIsOffline(!res.ok)
    }).catch(() => {
      if (!cancelled) setIsOffline(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading

  const handleLogin = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
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
      const res = await api.login(username.trim(), password)
      if (res.ok && res.data) {
        setAuth(res.data.token, res.data.entity)
      } else {
        const msg =
          typeof res.error === 'string'
            ? res.error
            : (res.error as { message?: string })?.message || 'Login failed'
        setError(msg)
      }
    } catch {
      setError('Network error -- cannot reach server')
    } finally {
      setLoading(false)
    }
  }

  const clearError = () => setError(null)

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Brand */}
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>ANI</Text>
            <Text style={styles.brandTagline}>{t('auth.tagline')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {isOffline ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{t('auth.offlineFirstLoginHint')}</Text>
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.username')}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(v) => {
                  clearError()
                  setUsername(v)
                }}
                placeholder={t('auth.enterUsername')}
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(v) => {
                    clearError()
                    setPassword(v)
                  }}
                  placeholder={t('auth.enterPassword')}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#9ca3af" />
                  ) : (
                    <Eye size={18} color="#9ca3af" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.gatewaySection}>
              <TouchableOpacity
                onPress={() => {
                  setError(null)
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
                    onChangeText={(v) => {
                      clearError()
                      setGateway(v)
                    }}
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
                        setError(null)
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

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <LogIn size={16} color="#ffffff" />
                  <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer links */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.footerText}>
                {t('auth.noAccount')}{' '}
                <Text style={styles.footerLink}>{t('auth.signUp')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  container: {
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  brand: {
    marginBottom: 40,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#1a1a2e',
  },
  brandTagline: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    lineHeight: 20,
  },
  form: {
    gap: 20,
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
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#1a1a2e',
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
  infoBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoText: {
    fontSize: 12,
    color: '#b45309',
    lineHeight: 18,
  },
  button: {
    height: 44,
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
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  footerLink: {
    fontWeight: '600',
    color: '#6366f1',
  },
})
