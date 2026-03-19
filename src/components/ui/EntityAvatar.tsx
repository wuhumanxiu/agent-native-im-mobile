import React, { useState, useMemo } from 'react'
import { View, Text, Image, StyleSheet, Pressable } from 'react-native'
import { Bot } from 'lucide-react-native'
import type { Entity } from '../../lib/types'
import { API_BASE_URL } from '../../lib/constants'

interface Props {
  entity?: Entity | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showStatus?: boolean
  isOnline?: boolean
  onPress?: () => void
}

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
}

const FONT_SIZE_MAP = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 18,
}

const DOT_SIZE_MAP = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
}

const ICON_SIZE_MAP = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
}

// Simple color generation from entity name
function entityColor(entity?: Entity | null): string {
  if (!entity) return '#94a3b8'
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4']
  let hash = 0
  const name = entity.name || ''
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function isBotOrService(entity?: { entity_type?: string } | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

function resolveAvatarUrl(url?: string): string | null {
  if (!url) return null
  // Already absolute URL or data URI
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) {
    return url
  }
  // Stable public avatar path backed by the server avatar endpoint.
  if (url.startsWith('/files/')) {
    return `${API_BASE_URL}/avatar-files/${url.slice('/files/'.length)}?v=1`
  }
  if (url.startsWith('/')) {
    return API_BASE_URL + url
  }
  return url
}

export function EntityAvatar({ entity, size = 'md', showStatus = false, isOnline = false, onPress }: Props) {
  const dimension = SIZE_MAP[size]
  const fontSize = FONT_SIZE_MAP[size]
  const dotDim = DOT_SIZE_MAP[size]
  const iconDim = ICON_SIZE_MAP[size]
  const color = entityColor(entity)
  const isBot = isBotOrService(entity)
  const [imgError, setImgError] = useState(false)

  const avatarUri = useMemo(() => resolveAvatarUrl(entity?.avatar_url), [entity?.avatar_url])
  const showImage = !!avatarUri && !imgError

  const content = (
    <View style={[styles.container, { width: dimension, height: dimension }]}>
      <View
        style={[
          styles.avatar,
          {
            width: dimension,
            height: dimension,
            borderRadius: 9999,
            backgroundColor: color + '22',
          },
          isBot && { borderWidth: 1, borderColor: color + '4D' },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: avatarUri }}
            style={[styles.avatarImage, { width: dimension, height: dimension, borderRadius: 9999 }]}
            onError={() => setImgError(true)}
          />
        ) : isBot ? (
          <Bot size={iconDim} color={color} />
        ) : (
          <Text style={[styles.initials, { fontSize, color }]}>
            {getInitials(entity?.display_name || entity?.name || '?')}
          </Text>
        )}
      </View>
      {showStatus && (
        <View
          style={[
            styles.statusDot,
            {
              width: dotDim,
              height: dotDim,
              borderRadius: dotDim / 2,
              backgroundColor: isOnline ? '#22c55e' : '#94a3b8',
            },
          ]}
        />
      )}
    </View>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8} style={styles.pressable}>
        {content}
      </Pressable>
    )
  }

  return content
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexShrink: 0,
  },
  pressable: {
    borderRadius: 9999,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  initials: {
    fontWeight: '600',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
})
