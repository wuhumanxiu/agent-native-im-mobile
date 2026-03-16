import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../theme/ThemeContext'
import { useAuthStore } from '../../store/auth'
import { EntityAvatar } from '../../components/entity/EntityAvatar'
import { entityDisplayName } from '../../lib/utils'
import * as api from '../../lib/api'
import { type ThemeName, themes, themeLabels, isDarkTheme } from '../../theme/colors'

const ALL_THEMES: ThemeName[] = [
  'dark', 'midnight', 'light', 'light-rose', 'light-ocean', 'light-green',
  'green', 'rose', 'ocean', 'amber', 'violet',
]

export function SettingsScreen() {
  const { colors, themeName, setTheme, isDark } = useTheme()
  const { t, i18n } = useTranslation()
  const { entity, token, setEntity, logout } = useAuthStore()

  const [editingProfile, setEditingProfile] = useState(false)
  const [displayName, setDisplayName] = useState(entity?.display_name || '')
  const [email, setEmail] = useState(entity?.email || '')
  const [saving, setSaving] = useState(false)

  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [showThemePicker, setShowThemePicker] = useState(false)

  const handleSaveProfile = useCallback(async () => {
    if (!token || !entity) return
    setSaving(true)
    const res = await api.updateProfile(token, {
      display_name: displayName.trim() || undefined,
      email: email.trim() || undefined,
    })
    if (res.ok && res.data) {
      setEntity(res.data)
      setEditingProfile(false)
      Alert.alert(t('settings.profileSaved'))
    }
    setSaving(false)
  }, [token, entity, displayName, email, setEntity, t])

  const handleChangePassword = useCallback(async () => {
    if (!token) return
    if (newPassword.length < 6) {
      Alert.alert(t('settings.passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('settings.passwordMismatch'))
      return
    }
    setSavingPassword(true)
    const res = await api.changePassword(token, currentPassword, newPassword)
    if (res.ok) {
      Alert.alert(t('settings.passwordChanged'))
      setChangingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      Alert.alert(t('settings.passwordChangeError'))
    }
    setSavingPassword(false)
  }, [token, currentPassword, newPassword, confirmPassword, t])

  const handleAvatarPick = useCallback(async () => {
    if (!token || !entity) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    })
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0]
      const filename = asset.uri.split('/').pop() || 'avatar.jpg'
      const uploadRes = await api.uploadFile(token, {
        uri: asset.uri,
        name: filename,
        type: asset.mimeType || 'image/jpeg',
      })
      if (uploadRes.ok && uploadRes.data?.url) {
        const profileRes = await api.updateProfile(token, { avatar_url: uploadRes.data.url })
        if (profileRes.ok && profileRes.data) {
          setEntity(profileRes.data)
        }
      }
    }
  }, [token, entity, setEntity])

  const handleLogout = useCallback(() => {
    Alert.alert(t('common.signOut'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.signOut'),
        style: 'destructive',
        onPress: () => logout(),
      },
    ])
  }, [logout, t])

  const toggleLanguage = useCallback(() => {
    const nextLng = i18n.language === 'en' ? 'zh-CN' : 'en'
    i18n.changeLanguage(nextLng)
  }, [i18n])

  const isZh = i18n.language.startsWith('zh')

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Pressable onPress={handleAvatarPick} style={styles.profileRow}>
            <EntityAvatar entity={entity} size="lg" />
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                {entityDisplayName(entity)}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
                {entity?.email || entity?.name || ''}
              </Text>
            </View>
          </Pressable>

          {editingProfile ? (
            <View style={styles.editSection}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('settings.displayName')}</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>{t('settings.email')}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.editButtons}>
                <Pressable
                  onPress={() => setEditingProfile(false)}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t('settings.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.5 : 1 }]}
                >
                  <Text style={styles.saveBtnText}>{t('settings.save')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => { setEditingProfile(true); setDisplayName(entity?.display_name || ''); setEmail(entity?.email || '') }}
              style={({ pressed }) => [styles.editProfileBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.editProfileBtnText, { color: colors.accent }]}>{t('settings.editProfile')}</Text>
            </Pressable>
          )}
        </View>

        {/* Security — Change Password */}
        <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }]}>
            {t('settings.security')}
          </Text>

          {changingPassword ? (
            <View style={styles.editSection}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('settings.currentPassword')}</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
                secureTextEntry
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>{t('settings.newPassword')}</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
                secureTextEntry
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>{t('settings.confirmPassword')}</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.border }]}
                secureTextEntry
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.editButtons}>
                <Pressable
                  onPress={() => { setChangingPassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t('settings.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleChangePassword}
                  disabled={savingPassword}
                  style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: savingPassword ? 0.5 : 1 }]}
                >
                  <Text style={styles.saveBtnText}>{t('settings.save')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setChangingPassword(true)}
              style={({ pressed }) => [styles.editProfileBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.editProfileBtnText, { color: colors.accent }]}>{t('settings.changePassword')}</Text>
            </Pressable>
          )}
        </View>

        {/* Appearance — Theme picker */}
        <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Pressable
            onPress={() => setShowThemePicker(!showThemePicker)}
            style={styles.settingRow}
          >
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.theme')}</Text>
            <Text style={[styles.settingValueText, { color: colors.accent }]}>
              {isZh ? themeLabels[themeName].zh : themeLabels[themeName].en}
            </Text>
          </Pressable>

          {showThemePicker && (
            <View style={styles.themeGrid}>
              {ALL_THEMES.map((name) => {
                const tColors = themes[name]
                const isSelected = name === themeName
                const label = isZh ? themeLabels[name].zh : themeLabels[name].en
                return (
                  <Pressable
                    key={name}
                    onPress={() => { setTheme(name); setShowThemePicker(false) }}
                    style={[
                      styles.themeChip,
                      {
                        backgroundColor: tColors.bgSecondary,
                        borderColor: isSelected ? colors.accent : tColors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={styles.themePreview}>
                      <View style={[styles.themePreviewDot, { backgroundColor: tColors.accent }]} />
                      <View style={[styles.themePreviewDot, { backgroundColor: tColors.textPrimary, width: 6, height: 6 }]} />
                    </View>
                    <Text style={[styles.themeChipLabel, { color: tColors.textPrimary }]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          <View style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.language')}</Text>
            <Pressable onPress={toggleLanguage}>
              <Text style={[styles.settingValueText, { color: colors.accent }]}>
                {i18n.language === 'en' ? 'English' : '\u4E2D\u6587'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* About */}
        <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t('settings.about')}</Text>
            <Text style={[styles.settingValueText, { color: colors.textMuted }]}>v1.0.0</Text>
          </View>
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: colors.error + '15',
              borderColor: colors.error + '30',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.logoutBtnText, { color: colors.error }]}>{t('common.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  editProfileBtn: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValueText: {
    fontSize: 14,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  themeChip: {
    width: '30%',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    flexGrow: 1,
    minWidth: 90,
    maxWidth: 120,
  },
  themePreview: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  themePreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  themeChipLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
