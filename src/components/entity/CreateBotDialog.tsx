import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet, Keyboard, TouchableWithoutFeedback, ScrollView,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { X, Plus, Loader2 } from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import * as api from '../../lib/api'
import { extractError, reportError } from '../../lib/errors'
import type { Entity } from '../../lib/types'

interface Props {
  visible: boolean
  onClose: () => void
  onCreated: (result: { entity: Entity; key: string; doc: string }) => void
}

export function CreateBotDialog({ visible, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const token = useAuthStore((s) => s.token)!
  const [name, setName] = useState('')
  const [botId, setBotId] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const normalizedBotId = botId.trim()
  const botIdValid = /^bot_[a-z0-9][a-z0-9_-]{2,63}$/.test(normalizedBotId)

  const handleCreate = async () => {
    if (!name.trim() || !botIdValid) return
    Keyboard.dismiss()
    setCreating(true)
    setError('')
    try {
      const meta: Record<string, unknown> = {}
      if (description.trim()) meta.description = description.trim()
      if (tags.trim()) meta.tags = tags.split(',').map((v) => v.trim()).filter(Boolean)
      meta.auto_approve = true

      const res = await api.createEntityWithOptions(token, name.trim(), {
        bot_id: normalizedBotId,
        display_name: name.trim(),
        metadata: Object.keys(meta).length > 0 ? meta : undefined,
      })
      if (res.ok && res.data) {
        const entity = res.data.entity
        onCreated({
          entity,
          key: res.data.api_key || res.data.bootstrap_key || '',
          doc: res.data.markdown_doc,
        })
        // Reset form
        setName('')
        setBotId('')
        setDescription('')
        setTags('')
      } else {
        const parsed = extractError(res)
        setError(parsed.message)
        reportError(parsed)
      }
    } catch {
      setError(t('common.error'))
    }
    setCreating(false)
  }

  const handleClose = () => {
    setName('')
    setBotId('')
    setDescription('')
    setTags('')
    setError('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('bot.createAgent')}</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <X size={16} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('bot.agentName')} *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('bot.namePlaceholder')}
                placeholderTextColor="#94a3b8"
                style={styles.input}
                autoFocus
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('bot.botIdLabel')} *</Text>
              <TextInput
                value={botId}
                onChangeText={(value) => setBotId(value.trim().toLowerCase())}
                placeholder={t('bot.botIdPlaceholder')}
                placeholderTextColor="#94a3b8"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hintText}>{t('bot.botIdHint')}</Text>
              {botId && !botIdValid ? (
                <Text style={styles.errorText}>{t('bot.botIdInvalid')}</Text>
              ) : null}
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('bot.descriptionLabel')}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('bot.descriptionPlaceholder')}
                placeholderTextColor="#94a3b8"
                style={[styles.input, styles.textarea]}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Tags */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('bot.tagsLabel')}</Text>
              <TextInput
                value={tags}
                onChangeText={setTags}
                placeholder={t('bot.tagsPlaceholder')}
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </View>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={handleClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={creating || !name.trim() || !botIdValid}
              style={[styles.createBtn, (creating || !name.trim() || !botIdValid) && styles.createBtnDisabled]}
            >
              {creating
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Plus size={14} color="#ffffff" />
              }
              <Text style={styles.createBtnText}>{t('common.create')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  field: {
    gap: 4,
  },
  hintText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  label: {
    fontSize: 10,
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
  textarea: {
    height: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 11,
    color: '#dc2626',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
  },
})
