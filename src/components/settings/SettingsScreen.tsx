import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, Switch,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import {
  User, Lock, Palette, Globe, ChevronRight, Bell,
  Check, Eye, EyeOff, Smartphone, LogOut, Info, ArrowLeft, Copy,
} from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import * as api from '../../lib/api'
import { buildInfo } from '../../lib/build-info'
import { EntityAvatar } from '../ui/EntityAvatar'
import { resolveThemeColors, themePreviews, useThemeColors } from '../../lib/theme'

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
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme)

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

  const systemPreview = resolveThemeColors('system')
  const themeOptions: { id: Theme; label: string; group: 'light' | 'dark' | 'system'; preview: { bg: string; sidebar: string; bubble: string; bubbleSelf: string; text: string } }[] = [
    {
      id: 'system',
      label: t('settings.themeSystem'),
      group: 'system',
      preview: {
        bg: systemPreview.bgSecondary,
        sidebar: systemPreview.bgTertiary,
        bubble: systemPreview.bubbleOther,
        bubbleSelf: systemPreview.accent,
        text: systemPreview.text,
      },
    },
    { id: 'light', label: t('settings.themeLight'), group: 'light', preview: themePreviews.light },
    { id: 'light-rose', label: t('settings.themeLightRose'), group: 'light', preview: themePreviews['light-rose'] },
    { id: 'light-ocean', label: t('settings.themeLightOcean'), group: 'light', preview: themePreviews['light-ocean'] },
    { id: 'light-green', label: t('settings.themeLightGreen'), group: 'light', preview: themePreviews['light-green'] },
    { id: 'dark', label: t('settings.themeDark'), group: 'dark', preview: themePreviews.dark },
    { id: 'midnight', label: t('settings.themeMidnight'), group: 'dark', preview: themePreviews.midnight },
    { id: 'green', label: t('settings.themeGreen'), group: 'dark', preview: themePreviews.green },
    { id: 'rose', label: t('settings.themeRose'), group: 'dark', preview: themePreviews.rose },
    { id: 'ocean', label: t('settings.themeOcean'), group: 'dark', preview: themePreviews.ocean },
    { id: 'amber', label: t('settings.themeAmber'), group: 'dark', preview: themePreviews.amber },
    { id: 'violet', label: t('settings.themeViolet'), group: 'dark', preview: themePreviews.violet },
  ]
  const lightThemeOptions = themeOptions.filter((option) => option.group === 'light')
  const darkThemeOptions = themeOptions.filter((option) => option.group === 'dark')

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
                  <Text style={[styles.profileName, { color: colors.text }]}>{entityDisplayName(entity)}</Text>
                  <Text style={[styles.profileHandle, { color: colors.textMuted }]}>@{entity?.name}</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('settings.displayName')}</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, {
                    backgroundColor: colors.bgTertiary,
                    borderColor: colors.border,
                    color: colors.text,
                  }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('settings.email')}</Text>
                <TextInput
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder={t('settings.emailPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, {
                    backgroundColor: colors.bgTertiary,
                    borderColor: colors.border,
                    color: colors.text,
                  }]}
                />
              </View>

              {saveMsg ? (
                <Text style={[styles.successText, { color: colors.success }]}>{saveMsg}</Text>
              ) : null}

              <Pressable
                onPress={handleSaveProfile}
                disabled={saving}
                style={[styles.primaryBtn, { backgroundColor: colors.accent }, saving && styles.btnDisabled]}
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
              <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>{t('settings.changePasswordDesc')}</Text>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('settings.currentPassword')}</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={oldPass}
                    onChangeText={setOldPass}
                    secureTextEntry={!showOld}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.passwordInput, {
                      backgroundColor: colors.bgTertiary,
                      borderColor: colors.border,
                      color: colors.text,
                    }]}
                  />
                  <Pressable onPress={() => setShowOld(!showOld)} style={styles.eyeBtn}>
                    {showOld ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('settings.newPassword')}</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={newPass}
                    onChangeText={setNewPass}
                    secureTextEntry={!showNew}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.passwordInput, {
                      backgroundColor: colors.bgTertiary,
                      borderColor: colors.border,
                      color: colors.text,
                    }]}
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                    {showNew ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('settings.confirmPassword')}</Text>
                <TextInput
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, {
                    backgroundColor: colors.bgTertiary,
                    borderColor: colors.border,
                    color: colors.text,
                  }]}
                />
              </View>

              {passError ? <Text style={[styles.errorText, { color: colors.error }]}>{passError}</Text> : null}
              {passSuccess ? <Text style={[styles.successText, { color: colors.success }]}>{passSuccess}</Text> : null}

              <Pressable
                onPress={handleChangePassword}
                disabled={saving}
                style={[styles.primaryBtn, { backgroundColor: colors.accent }, saving && styles.btnDisabled]}
              >
                <Text style={styles.primaryBtnText}>{t('settings.changePassword')}</Text>
              </Pressable>
            </View>
          )}

          {/* Devices */}
          {section === 'devices' && (
            <View style={styles.sectionContent}>
              <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>{t('settings.devicesDesc')}</Text>

              {deviceMsg ? (
                <Text style={[styles.successText, { color: colors.success }]}>{deviceMsg}</Text>
              ) : null}

              {devicesLoading ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20 }} />
              ) : devices.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('settings.noDevices')}</Text>
              ) : (
                <View style={styles.deviceList}>
                  {devices.map((d) => (
                    <View key={d.device_id} style={[styles.deviceItem, { backgroundColor: colors.bgTertiary, borderColor: colors.border }]}>
                      <Smartphone size={16} color={colors.textMuted} />
                      <View style={styles.deviceInfo}>
                        <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
                          {d.device_info?.slice(0, 50) || t('settings.unknownDevice')}
                        </Text>
                        <Text style={[styles.deviceId, { color: colors.textMuted }]}>{d.device_id.slice(0, 12)}...</Text>
                      </View>
                      <Pressable
                        onPress={() => handleKickDevice(d.device_id)}
                        style={[styles.disconnectBtn, { backgroundColor: `${colors.error}20` }]}
                      >
                        <Text style={[styles.disconnectBtnText, { color: colors.error }]}>{t('settings.disconnectDevice')}</Text>
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
              <Pressable
                onPress={() => setSelectedTheme('system')}
                style={[
                  styles.systemThemeCard,
                  {
                    borderColor: selectedTheme === 'system' ? colors.accent : colors.border,
                    backgroundColor: selectedTheme === 'system' ? colors.accentDim : colors.bg,
                  },
                ]}
              >
                <View>
                  <Text style={[styles.systemThemeTitle, { color: colors.text }]}>{t('settings.themeSystem')}</Text>
                  <Text style={[styles.systemThemeDesc, { color: colors.textMuted }]}>
                    {t('settings.themeSystemDesc')} · {effectiveTheme() === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
                  </Text>
                </View>
                {selectedTheme === 'system' ? <Check size={16} color={colors.accent} /> : null}
              </Pressable>

              <View style={styles.themeSection}>
                <Text style={[styles.themeGroupTitle, { color: colors.textMuted }]}>{t('settings.themeGroupLight')}</Text>
                <View style={styles.themeGrid}>
                  {lightThemeOptions.map((theme) => (
                    <Pressable
                      key={theme.id}
                      onPress={() => setSelectedTheme(theme.id)}
                      style={[
                        styles.themeCard,
                        {
                          borderColor: selectedTheme === theme.id ? colors.accent : colors.border,
                          backgroundColor: colors.bg,
                        },
                      ]}
                    >
                      <View style={[styles.themePreviewCard, { backgroundColor: theme.preview.bg }]}>
                        <View style={[styles.themePreviewSidebar, { backgroundColor: theme.preview.sidebar }]}>
                          <View style={[styles.themePreviewDot, { backgroundColor: theme.preview.bubbleSelf }]} />
                          <View style={[styles.themePreviewMiniDot, { backgroundColor: theme.preview.bubble }]} />
                        </View>
                        <View style={styles.themePreviewMain}>
                          <View style={[styles.themePreviewBubble, { backgroundColor: theme.preview.bubble, width: '64%' }]} />
                          <View style={[styles.themePreviewBubble, styles.themePreviewBubbleSelf, { backgroundColor: theme.preview.bubbleSelf, width: '44%' }]} />
                          <View style={[styles.themePreviewBubble, { backgroundColor: theme.preview.bubble, width: '54%' }]} />
                        </View>
                      </View>
                      <View style={styles.themeCardFooter}>
                        <Text style={[styles.themeLabel, { color: colors.textSecondary }]}>{theme.label}</Text>
                        {selectedTheme === theme.id ? <Check size={14} color={colors.accent} /> : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.themeSection}>
                <Text style={[styles.themeGroupTitle, { color: colors.textMuted }]}>{t('settings.themeGroupDark')}</Text>
                <View style={styles.themeGrid}>
                  {darkThemeOptions.map((theme) => (
                    <Pressable
                      key={theme.id}
                      onPress={() => setSelectedTheme(theme.id)}
                      style={[
                        styles.themeCard,
                        {
                          borderColor: selectedTheme === theme.id ? colors.accent : colors.border,
                          backgroundColor: colors.bg,
                        },
                      ]}
                    >
                      <View style={[styles.themePreviewCard, { backgroundColor: theme.preview.bg }]}>
                        <View style={[styles.themePreviewSidebar, { backgroundColor: theme.preview.sidebar }]}>
                          <View style={[styles.themePreviewDot, { backgroundColor: theme.preview.bubbleSelf }]} />
                          <View style={[styles.themePreviewMiniDot, { backgroundColor: theme.preview.bubble }]} />
                        </View>
                        <View style={styles.themePreviewMain}>
                          <View style={[styles.themePreviewBubble, { backgroundColor: theme.preview.bubble, width: '64%' }]} />
                          <View style={[styles.themePreviewBubble, styles.themePreviewBubbleSelf, { backgroundColor: theme.preview.bubbleSelf, width: '44%' }]} />
                          <View style={[styles.themePreviewBubble, { backgroundColor: theme.preview.bubble, width: '54%' }]} />
                        </View>
                      </View>
                      <View style={styles.themeCardFooter}>
                        <Text style={[styles.themeLabel, { color: colors.textSecondary }]}>{theme.label}</Text>
                        {selectedTheme === theme.id ? <Check size={14} color={colors.accent} /> : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
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
                  style={[
                    styles.langItem,
                    {
                      borderColor: selectedLocale === lang.id ? colors.accent : colors.border,
                      backgroundColor: selectedLocale === lang.id ? colors.accentDim : colors.bg,
                    },
                  ]}
                >
                  <Text style={[
                    styles.langText,
                    { color: selectedLocale === lang.id ? colors.accent : colors.text },
                    selectedLocale === lang.id && styles.langTextActive,
                  ]}>
                    {lang.label}
                  </Text>
                  {selectedLocale === lang.id && <Check size={16} color={colors.accent} />}
                </Pressable>
              ))}
            </View>
          )}

          {/* Notifications */}

          {/* About */}
          {section === 'about' && (
            <View style={styles.sectionContent}>
              <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>{t('settings.aboutDesc')}</Text>

              <View style={[styles.aboutCard, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                {[
                  { label: t('settings.appName'), value: 'ANI' },
                  { label: t('settings.version'), value: buildInfo.version, mono: true },
                  { label: t('settings.runtimeVersion'), value: buildInfo.runtimeVersion, mono: true },
                  { label: t('settings.commit'), value: buildInfo.commit, mono: true },
                  { label: t('settings.buildTime'), value: new Date(buildInfo.buildTime).toLocaleString() },
                ].map(({ label, value, mono }, index) => (
                  <View
                    key={label}
                    style={[
                      styles.aboutRow,
                      index > 0 && styles.aboutRowBorder,
                      index > 0 && { borderTopColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{label}</Text>
                    <Text style={[styles.aboutValue, { color: colors.text }, mono && styles.aboutValueMono]}>{value}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync([
                    'app=ANI',
                    `version=${buildInfo.version}`,
                    `runtime_version=${buildInfo.runtimeVersion}`,
                    `commit=${buildInfo.commit}`,
                    `build_time=${buildInfo.buildTime}`,
                  ].join('\n'))
                  setAboutCopied(true)
                  setTimeout(() => setAboutCopied(false), 2000)
                }}
                style={[styles.copyBtn, { backgroundColor: aboutCopied ? colors.success : colors.accent }]}
              >
                {aboutCopied ? <Check size={14} color="#ecfdf5" /> : <Copy size={14} color="#ffffff" />}
                <Text style={[styles.copyBtnText, aboutCopied && styles.copyBtnTextSuccess]}>
                  {aboutCopied ? t('common.copied') : t('settings.copyVersionInfo')}
                </Text>
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
                <View style={styles.navItemBody}>
                  <Text style={[styles.navItemText, { color: colors.text }]}>{item.label}</Text>
                  {item.id === 'about' && (
                    <Text style={[styles.navItemMeta, { color: colors.textMuted }]}>v{buildInfo.version}</Text>
                  )}
                </View>
                <ChevronRight size={16} color={colors.textMuted} />
              </Pressable>
            )
          })}
        </View>

        {/* Push notifications toggle */}
        <View style={[styles.navGroup, { borderBottomColor: colors.bgTertiary }]}>
          <View style={styles.toggleRow}>
            <Bell size={18} color={colors.textSecondary} />
            <View style={styles.toggleBody}>
              <Text style={[styles.navItemText, { color: colors.text }]}>{t('settings.pushNotifications')}</Text>
              <Text style={[styles.navItemMeta, { color: colors.textMuted }]}>{t('settings.pushWebOnly')}</Text>
            </View>
            <Switch
              value={pushEnabled}
              disabled
              onValueChange={() => {
                Alert.alert(
                  t('settings.pushNotifications'),
                  t('settings.pushNativePending'),
                  [{ text: 'OK' }]
                )
              }}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Sign out */}
        <Pressable onPress={handleSignOut} style={[styles.signOutBtn, { backgroundColor: `${colors.error}18` }]}>
          <LogOut size={18} color={colors.error} />
          <Text style={[styles.signOutText, { color: colors.error }]}>{t('sidebar.signOut')}</Text>
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
  navItemBody: {
    flex: 1,
    minWidth: 0,
  },
  navItemPressed: {
    backgroundColor: '#f8fafc',
  },
  navItemText: {
    fontSize: 15,
    color: '#1e293b',
  },
  navItemMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  toggleBody: {
    flex: 1,
    minWidth: 0,
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
    borderWidth: 1,
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
  themeSection: {
    gap: 12,
  },
  themeGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  systemThemeCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  systemThemeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  systemThemeDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 18,
  },
  themeCard: {
    width: 104,
    gap: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  themePreviewCard: {
    width: '100%',
    height: 86,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  themePreviewSidebar: {
    width: 16,
    alignItems: 'center',
    paddingTop: 10,
    gap: 5,
  },
  themePreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  themePreviewMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  themePreviewMain: {
    flex: 1,
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },
  themePreviewBubble: {
    height: 8,
    borderRadius: 999,
  },
  themePreviewBubbleSelf: {
    alignSelf: 'flex-end',
  },
  themeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  themeLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
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
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 18,
  },
  aboutRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  aboutLabel: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    paddingTop: 1,
  },
  aboutValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    lineHeight: 18,
  },
  aboutValueMono: {
    fontFamily: 'monospace',
  },
  aboutCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    paddingVertical: 2,
  },
  copyBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    marginTop: 8,
  },
  copyBtnText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  copyBtnTextSuccess: {
    color: '#dcfce7',
  },
})
