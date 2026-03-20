import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Bot, MessageSquare, Sparkles, ArrowRight } from 'lucide-react-native'
import { useThemeColors } from '../../lib/theme'

interface Props {
  onNewChat?: () => void
  onManageBots?: () => void
  compact?: boolean
}

export function OnboardingCard({ onNewChat, onManageBots, compact = false }: Props) {
  const { t } = useTranslation()
  const colors = useThemeColors()

  const steps = [
    {
      key: 'mention',
      icon: Bot,
      title: t('onboarding.stepMentionTitle'),
      description: t('onboarding.stepMentionDescription'),
      iconColor: colors.bot,
      iconBg: `${colors.bot}22`,
    },
    {
      key: 'context',
      icon: Sparkles,
      title: t('onboarding.stepContextTitle'),
      description: t('onboarding.stepContextDescription'),
      iconColor: colors.accent,
      iconBg: `${colors.accent}22`,
    },
    {
      key: 'interaction',
      icon: MessageSquare,
      title: t('onboarding.stepInteractionTitle'),
      description: t('onboarding.stepInteractionDescription'),
      iconColor: '#10b981',
      iconBg: 'rgba(16,185,129,0.14)',
    },
  ]

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: colors.bgSecondary,
        borderColor: colors.border,
        padding: compact ? 16 : 18,
      },
    ]}>
      <View style={compact ? styles.headerCompact : styles.header}>
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{t('onboarding.eyebrow')}</Text>
        <Text style={[compact ? styles.titleCompact : styles.title, { color: colors.text }]}>
          {t('onboarding.title')}
        </Text>
        <Text style={[compact ? styles.descriptionCompact : styles.description, { color: colors.textSecondary }]}>
          {t('onboarding.description')}
        </Text>
      </View>

      <View style={compact ? styles.stepsCompact : styles.steps}>
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: step.iconBg }]}>
                <Icon size={16} color={step.iconColor} />
              </View>
              <View style={styles.stepBody}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                <Text style={[styles.stepDescription, { color: colors.textMuted }]}>{step.description}</Text>
              </View>
            </View>
          )
        })}
      </View>

      <View style={[styles.boundaryCard, { backgroundColor: colors.bgTertiary, borderColor: colors.border }]}>
        <Text style={[styles.boundaryTitle, { color: colors.text }]}>{t('onboarding.boundaryTitle')}</Text>
        <Text style={[styles.boundaryDescription, { color: colors.textMuted }]}>
          {t('onboarding.boundaryDescription')}
        </Text>
      </View>

      {!compact && (onNewChat || onManageBots) && (
        <View style={styles.actions}>
          {onNewChat && (
            <Pressable style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={onNewChat}>
              <Text style={styles.primaryButtonText}>{t('onboarding.primaryAction')}</Text>
              <ArrowRight size={14} color="#ffffff" />
            </Pressable>
          )}
          {onManageBots && (
            <Pressable style={[styles.secondaryButton, { backgroundColor: colors.bgTertiary, borderColor: colors.border }]} onPress={onManageBots}>
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>{t('onboarding.secondaryAction')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 26,
  },
  header: {
    marginBottom: 16,
  },
  headerCompact: {
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  titleCompact: {
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  descriptionCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  steps: {
    gap: 12,
  },
  stepsCompact: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  boundaryCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  boundaryTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  boundaryDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
