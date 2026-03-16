import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useTheme } from '../../theme/ThemeContext'
import { usePresenceStore } from '../../store/presence'
import { useAuthStore } from '../../store/auth'
import { getInitials, entityColor, authenticatedFileUrl } from '../../lib/utils'
import { getBaseUrl } from '../../lib/api'
import type { Entity } from '../../lib/types'

type AvatarSize = 'sm' | 'md' | 'lg'

const sizes: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
}

const fontSizes: Record<AvatarSize, number> = {
  sm: 13,
  md: 16,
  lg: 22,
}

interface EntityAvatarProps {
  entity?: Entity | null
  size?: AvatarSize
  showOnline?: boolean
}

export function EntityAvatar({ entity, size = 'md', showOnline = false }: EntityAvatarProps) {
  const { colors } = useTheme()
  const online = usePresenceStore((s) => s.online)
  const token = useAuthStore((s) => s.token)
  const dim = sizes[size]
  const fontSize = fontSizes[size]
  const bgColor = entityColor(entity)
  const isOnline = entity ? online.has(entity.id) : false

  const avatarUrl = entity?.avatar_url
    ? authenticatedFileUrl(entity.avatar_url, token, getBaseUrl())
    : null

  const dotSize = size === 'sm' ? 8 : size === 'md' ? 10 : 14
  const dotBorder = size === 'sm' ? 1.5 : 2

  return (
    <View style={[styles.container, { width: dim, height: dim }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, { width: dim, height: dim, borderRadius: dim / 2 }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.fallback, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bgColor }]}>
          <Text style={[styles.initials, { fontSize, color: '#ffffff' }]}>
            {getInitials(entity?.display_name || entity?.name || '?')}
          </Text>
        </View>
      )}
      {showOnline && isOnline && (
        <View style={[
          styles.onlineDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            borderWidth: dotBorder,
            borderColor: colors.bgPrimary,
            backgroundColor: colors.success,
          },
        ]} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
})
