import React, { useState, useEffect } from 'react'
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Users, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react-native'
import * as api from '../../lib/api'

interface Props {
  code: string
  token: string
  onJoined: (conversationId: number) => void
  onCancel: () => void
}

export function JoinInvitePage({ code, token, onJoined, onCancel }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [inviteInfo, setInviteInfo] = useState<{
    conversation?: { id: number; title?: string; conv_type?: string }
    invite?: { code: string; use_count?: number; max_uses?: number; expires_at?: string }
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      const res = await api.getInviteInfo(token, code)
      if (cancelled) return
      if (res.ok && res.data) {
        setInviteInfo(res.data as Record<string, unknown>)
      } else {
        setError(String(res.error || t('invite.invalidOrExpired')))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [token, code, t])

  const handleJoin = async () => {
    setJoining(true)
    setError('')
    const res = await api.joinViaInvite(token, code)
    if (res.ok) {
      setJoined(true)
      const convId = Number((res.data as Record<string, unknown>)?.id ?? inviteInfo?.conversation?.id)
      setTimeout(() => {
        if (convId) onJoined(convId)
      }, 1000)
    } else {
      setError(String(res.error || t('invite.joinFailed')))
    }
    setJoining(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : error && !inviteInfo ? (
          <View style={styles.centered}>
            <AlertCircle size={40} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={onCancel} style={styles.backBtn}>
              <Text style={styles.backBtnText}>{t('legal.back')}</Text>
            </Pressable>
          </View>
        ) : joined ? (
          <View style={styles.centered}>
            <CheckCircle2 size={40} color="#16a34a" />
            <Text style={styles.successText}>{t('invite.joinedSuccess')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.inviteHeader}>
              <View style={styles.inviteIcon}>
                <Users size={28} color="#6366f1" />
              </View>
              <Text style={styles.inviteTitle}>
                {inviteInfo?.conversation?.title || t('conversation.unnamed')}
              </Text>
              <Text style={styles.inviteSubtitle}>
                {t('invite.invitedToJoin')}
              </Text>
            </View>

            {error ? (
              <Text style={styles.inlineError}>{error}</Text>
            ) : null}

            <View style={styles.buttonsRow}>
              <Pressable onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleJoin}
                disabled={joining}
                style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
              >
                {joining
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <ArrowRight size={16} color="#ffffff" />
                }
                <Text style={styles.joinBtnText}>
                  {joining ? t('invite.joining') : t('invite.join')}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 24,
    gap: 20,
  },
  centered: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  backBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  backBtnText: {
    fontSize: 14,
    color: '#64748b',
  },
  inviteHeader: {
    alignItems: 'center',
    gap: 12,
  },
  inviteIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
  inviteSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  inlineError: {
    fontSize: 12,
    color: '#dc2626',
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#64748b',
  },
  joinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
})
