import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, Switch,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import {
  User, Lock, Palette, Globe, ChevronRight, Bell,
  Check, Eye, EyeOff, Smartphone, LogOut, Info, ArrowLeft,
} from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import * as api from '../../lib/api'
import { EntityAvatar } from '../ui/EntityAvatar'
import { useThemeColors } from '../../lib/theme'

type Section = 'profile' | 'security' | 'devices' | 'theme' | 'language' | 'about' | null

type Theme = 'light' | 'dark' | 'midnight' | 'green' | 'rose' | 'ocean' | 'amber' | 'violet' |
  'light-rose' | 'light-ocean' | 'light-green' | 'system'

interface Props {
  onBack: () => void
}

function entityDisplayName(entity?: { display_name?: string; name?: string } | null): string {
  if (!entity) return '?'
  return entity.display_name || entity.name || '?'
}

export function SettingsScreen({ onBack }: Props) {
  const { t, i18n } = useTranslation()
  const colors = useThemeColors()
  const entity = useAuthStore((s) => s.entity)
  const token = useAuthStore((s) => s.token)!
  const logoutAction = useAuthStore((s) => s.logout)

  const [section, setSection] = useState<Section>(null)
  const [editName, setEditName] = useState(entity?.display_name || '')
  const [editEmail, setEditEmail] = useState(entity?.email || '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Password
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')

  // Theme — read/write from Zustand store so it persists and triggers re-renders
  const selectedTheme = useSettingsStore((s) => s.theme)
  const setSelectedTheme = useSettingsStore((s) => s.setTheme)

  // Language
  const [selectedLocale, setSelectedLocale] = useState(i18n.language || 'en')

  // Devices
  type DeviceItem = { device_id: string; device_info: string; entity_id: number }
  const [devices, setDevices] = useState<DeviceItem[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [deviceMsg, setDeviceMsg] = useState('')

  // About
  const [aboutCopied, setAboutCopied] = useState(false)

  // Push
  const [pushEnabled, setPushEnabled] = useState(false)

  const handleSaveProfile = async () => {
    if (!editName.trim() || !entity) return
    setSaving(true)
    setSaveMsg('')
    const updateData: { display_name?: string; email?: string } = {
      display_name: editName.trim(),
    }
    if (editEmail !== (entity.email || '')) {
      updateData.email = editEmail.trim()
    }
    const res = await api.updateProfile(token, updateData)
    if (res.ok) {
      setSaveMsg(t('settings.profileSaved'))
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleChangePassword = async () => {
    setPassError('')
    setPassSuccess('')
    if (newPass.length < 6) {
      setPassError(t('settings.passwordTooShort'))
      return
    }
    if (newPass !== confirmPass) {
      setPassError(t('settings.passwordMismatch'))
      return
    }
    setSaving(true)
    const res = await api.changePassword(token, oldPass, newPass)
    setSaving(false)
    if (res.ok) {
      setPassSuccess(t('settings.passwordChanged'))
      setOldPass('')
      setNewPass('')
      setConfirmPass('')
    } else {
      setPassError(typeof res.error === 'string' ? res.error : (res.error?.message || t('settings.passwordError')))
    }
  }

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true)
    setDeviceMsg('')
    const res = await api.listDevices(token)
    if (res.ok && res.data?.devices) {
      const deviceMap = new Map<string, DeviceItem>()
      for (const device of res.data.devices) {
        if (!deviceMap.has(device.device_id)) {
          deviceMap.set(device.device_id, device)
        }
      }
      setDevices(Array.from(deviceMap.values()))
    } else {
      setDevices([])
    }
    setDevicesLoading(false)
  }, [token])

  useEffect(() => {
    if (section === 'devices') {
      setDevices([])
      loadDevices()
    }
  }, [section, loadDevices])

  const handleKickDevice = async (deviceId: string) => {
    const res = await api.kickDevice(token, deviceId)
    if (res.ok) {
      setDeviceMsg(t('settings.deviceDisconnected'))
      setTimeout(() => setDeviceMsg(''), 2000)
      loadDevices()
    }
  }

  const handleLanguageChange = (locale: string) => {
    setSelectedLocale(locale)
    i18n.changeLanguage(locale)
  }

  const handleSignOut = () => {
    Alert.alert(
      t('sidebar.signOut'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('sidebar.signOut'),
          style: 'destructive',
          onPress: () => logoutAction(),
        },
      ]
    )
  }

  const navItems: { id: Section; icon: React.ComponentType<{ size: number; color: string }>; label: string }[] = [
    { id: 'profile', icon: User, label: t('settings.profile') },
    { id: 'security', icon: Lock, label: t('settings.security') },
    { id: 'devices', icon: Smartphone, label: t('settings.devices') },
    { id: 'theme', icon: Palette, label: t('settings.theme') },
    { id: 'language', icon: Globe, label: t('settings.language') },
    { id: 'about', icon: Info, label: t('settings.about') },
  ]

  const themeOptions: { id: Theme; label: string; color: string }[] = [
    { id: 'light', label: t('settings.themeLight'), color: '#f8fafc' },
    { id: 'light-rose', label: t('settings.themeLightRose'), color: '#fdf2f8' },
    { id: 'light-ocean', label: t('settings.themeLightOcean'), color: '#f0f9ff' },
    { id: 'light-green', label: t('settings.themeLightGreen'), color: '#f0fdf4' },
    { id: 'dark', label: t('settings.themeDark'), color: '#1e293b' },
    { id: 'midnight', label: t('settings.themeMidnight'), color: '#0f172a' },
    { id: 'green', label: t('settings.themeGreen'), color: '#064e3b' },
    { id: 'rose', label: t('settings.themeRose'), color: '#4c0519' },
    { id: 'ocean', label: t('settings.themeOcean'), color: '#0c4a6e' },
    { id: 'amber', label: t('settings.themeAmber'), color: '#451a03' },
    { id: 'violet', label: t('settings.themeViolet'), color: '#2e1065' },
  ]

  // Section detail views
  if (section) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
        {/* Section header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setSection(null)} style={styles.backBtn}>
            <ArrowLeft size={16} color={colors.textSecondary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {navItems.find((n) => n.id === section)?.label || t('settings.title')}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile */}
          {section === 'profile' && (
            <View style={styles.sectionContent}>
              <View style={styles.profileAvatarRow}>
                <EntityAvatar entity={entity} size="lg" />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{entityDisplayName(entity)}</Text>
                  <Text style={styles.profileHandle}>@{entity?.name}</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('settings.displayName')}</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('settings.email')}</Text>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder={t('settings.emailPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              {saveMsg ? (
                <Text style={styles.successText}>{saveMsg}</Text>
              ) : null}

              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                style={[styles.primaryBtn, saving && styles.btnDisabled]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('common.save')}</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Security */}
          {section === 'security' && (
            <View style={styles.sectionContent}>
              <Text style={styles.sectionDesc}>{t('settings.changePasswordDesc')}</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('settings.currentPassword')}</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={oldPass}
                    onChangeText={setOldPass}
                    secureTextEntry={!showOld}
                    style={[styles.input, styles.passwordInput]}
                  />
                  <Pressable onPress={() => setShowOld(!showOld)} style={styles.eyeBtn}>
                    {showOld ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('settings.newPassword')}</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={newPass}
                    onChangeText={setNewPass}
                    secureTextEntry={!showNew}
                    style={[styles.input, styles.passwordInput]}
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                    {showNew ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('settings.confirmPassword')}</Text>
                <TextInput
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              {passError ? <Text style={styles.errorText}>{passError}</Text> : null}
              {passSuccess ? <Text style={styles.successText}>{passSuccess}</Text> : null}

              <Pressable
                onPress={handleChangePassword}
                disabled={saving}
                style={[styles.primaryBtn, saving && styles.btnDisabled]}
              >
                <Text style={styles.primaryBtnText}>{t('settings.changePassword')}</Text>
              </Pressable>
            </View>
          )}

          {/* Devices */}
          {section === 'devices' && (
            <View style={styles.sectionContent}>
              <Text style={styles.sectionDesc}>{t('settings.devicesDesc')}</Text>

              {deviceMsg ? (
                <Text style={styles.successText}>{deviceMsg}</Text>
              ) : null}

              {devicesLoading ? (
                <ActivityIndicator size="small" color="#6366f1" style={{ marginTop: 20 }} />
              ) : devices.length === 0 ? (
                <Text style={styles.emptyText}>{t('settings.noDevices')}</Text>
              ) : (
                <View style={styles.deviceList}>
                  {devices.map((d) => (
                    <View key={d.device_id} style={styles.deviceItem}>
                      <Smartphone size={16} color="#94a3b8" />
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {d.device_info?.slice(0, 50) || t('settings.unknownDevice')}
                        </Text>
                        <Text style={styles.deviceId}>{d.device_id.slice(0, 12)}...</Text>
                      </View>
                      <Pressable
                        onPress={() => handleKickDevice(d.device_id)}
                        style={styles.disconnectBtn}
                      >
                        <Text style={styles.disconnectBtnText}>{t('settings.disconnectDevice')}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Theme */}
          {section === 'theme' && (
            <View style={styles.sectionContent}>
              <View style={styles.themeGrid}>
                {themeOptions.map((theme) => (
                  <Pressable
                    key={theme.id}
                    onPress={() => setSelectedTheme(theme.id)}
                    style={[
                      styles.themeItem,
                      selectedTheme === theme.id && styles.themeItemActive,
                    ]}
                  >
                    <View style={[styles.themePreview, { backgroundColor: theme.color }]}>
                      {selectedTheme === theme.id && (
                        <Check size={16} color={theme.color === '#f8fafc' || theme.color.startsWith('#f') ? '#6366f1' : '#ffffff'} />
                      )}
                    </View>
                    <Text style={styles.themeLabel}>{theme.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Language */}
          {section === 'language' && (
            <View style={styles.sectionContent}>
              {[
                { id: 'en', label: 'English' },
                { id: 'zh-CN', label: '中文 (简体)' },
              ].map((lang) => (
                <Pressable
                  key={lang.id}
                  onPress={() => handleLanguageChange(lang.id)}
                  style={[styles.langItem, selectedLocale === lang.id && styles.langItemActive]}
                >
                  <Text style={[
                    styles.langText,
                    selectedLocale === lang.id && styles.langTextActive,
                  ]}>
                    {lang.label}
                  </Text>
                  {selectedLocale === lang.id && <Check size={16} color="#6366f1" />}
                </Pressable>
              ))}
            </View>
          )}

          {/* Notifications */}

          {/* About */}
          {section === 'about' && (
            <View style={styles.sectionContent}>
              <Text style={styles.sectionDesc}>{t('settings.aboutDesc')}</Text>

              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>{t('settings.appName')}</Text>
                <Text style={styles.aboutValue}>Agent-Native IM</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>{t('settings.version')}</Text>
                <Text style={styles.aboutValue}>1.0.0</Text>
              </View>

              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync('Agent-Native IM v1.0.0 (Mobile)')
                  setAboutCopied(true)
                  setTimeout(() => setAboutCopied(false), 2000)
                }}
                style={styles.copyBtn}
              >
                {aboutCopied
                  ? <Check size={14} color="#16a34a" />
                  : <Text style={styles.copyBtnText}>{t('settings.copyVersionInfo')}</Text>
                }
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    )
  }

  // Main menu
  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={16} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile preview */}
        <View style={[styles.profilePreview, { borderBottomColor: colors.bgTertiary }]}>
          <EntityAvatar entity={entity} size="lg" />
          <View style={styles.profilePreviewInfo}>
            <Text style={[styles.profilePreviewName, { color: colors.text }]}>{entityDisplayName(entity)}</Text>
            <Text style={[styles.profilePreviewEmail, { color: colors.textMuted }]}>{entity?.email || `@${entity?.name}`}</Text>
          </View>
        </View>

        {/* Nav items */}
        <View style={[styles.navGroup, { borderBottomColor: colors.bgTertiary }]}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Pressable
                key={item.id}
                onPress={() => setSection(item.id)}
                style={({ pressed }) => [styles.navItem, { borderBottomColor: colors.bg }, pressed && { backgroundColor: colors.bgHover }]}
              >
                <Icon size={18} color={colors.textSecondary} />
                <Text style={[styles.navItemText, { color: colors.text }]}>{item.label}</Text>
                <ChevronRight size={16} color={colors.textMuted} />
              </Pressable>
            )
          })}
        </View>

        {/* Push notifications toggle */}
        <View style={[styles.navGroup, { borderBottomColor: colors.bgTertiary }]}>
          <View style={styles.toggleRow}>
            <Bell size={18} color={colors.textSecondary} />
            <Text style={[styles.navItemText, { color: colors.text }]}>{t('settings.pushNotifications')}</Text>
            <Switch
              value={pushEnabled}
              onValueChange={(val) => {
                Alert.alert(
                  t('settings.pushNotifications'),
                  'Push notifications will be available in the standalone app build. Expo Go does not support push notifications.',
                  [{ text: 'OK' }]
                )
              }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Sign out */}
        <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
          <LogOut size={18} color="#dc2626" />
          <Text style={styles.signOutText}>{t('sidebar.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  scrollContent: {
    flex: 1,
  },
  profilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  profilePreviewInfo: {
    flex: 1,
  },
  profilePreviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  profilePreviewEmail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  navGroup: {
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  navItemPressed: {
    backgroundColor: '#f8fafc',
  },
  navItemText: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 40,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#dc2626',
  },
  // Section content styles
  sectionContent: {
    padding: 20,
    gap: 16,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
  profileAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  profileHandle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 14,
    color: '#1e293b',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  eyeBtn: {
    position: 'absolute',
    right: 8,
    padding: 8,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  successText: {
    fontSize: 12,
    color: '#16a34a',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  deviceList: {
    gap: 8,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    fontSize: 13,
    color: '#1e293b',
  },
  deviceId: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  disconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  disconnectBtnText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '500',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeItem: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  themeItemActive: {},
  themePreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeLabel: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  langItemActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  langText: {
    fontSize: 15,
    color: '#1e293b',
  },
  langTextActive: {
    fontWeight: '500',
    color: '#6366f1',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  aboutLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  aboutValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500',
  },
  copyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginTop: 8,
  },
  copyBtnText: {
    fontSize: 12,
    color: '#64748b',
  },
})
