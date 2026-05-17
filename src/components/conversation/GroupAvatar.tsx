import React, { useMemo, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import type { Entity, Participant } from '../../lib/types'
import { getApiBaseUrl } from '../../lib/gateway'

interface Props {
  participants?: Participant[]
  size?: number
}

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name
}

function getInitial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() || '?'
}

function entityColor(entity?: Entity | null): string {
  if (!entity) return '#64748b'
  if (entity.entity_type === 'bot') return '#a78bfa'
  if (entity.entity_type === 'service') return '#f59e0b'
  const colors = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c']
  let hash = 0
  for (const ch of entity.name || entity.display_name || '') {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  }
  return colors[Math.abs(hash) % colors.length]
}

function resolveAvatarUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) return url
  if (url.startsWith('/files/')) return `${getApiBaseUrl()}/avatar-files/${url.slice('/files/'.length)}?v=1`
  if (url.startsWith('/')) return getApiBaseUrl() + url
  return url
}

function gridColumns(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}

function participantKey(participant: Participant, index: number): string {
  return String(participant.entity?.public_id || participant.entity_id || participant.id || index)
}

export function GroupAvatar({ participants = [], size = 40 }: Props) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set())
  const members = useMemo(() => participants.slice(0, 9), [participants])
  const cols = gridColumns(members.length)
  const gap = cols === 1 ? 0 : 1
  const padding = 2
  const innerSize = size - padding * 2
  const tileSize = (innerSize - gap * (cols - 1)) / cols

  return (
    <View style={[styles.outer, { width: size, height: size, borderRadius: size / 2, padding }]}>
      <View style={[styles.grid, { gap, width: innerSize, height: innerSize }]}>
        {members.length > 0 ? members.map((participant, index) => {
          const entity = participant.entity
          const avatarUrl = resolveAvatarUrl(entity?.avatar_url)
          const showImage = !!avatarUrl && !failedUrls.has(avatarUrl)
          const color = entityColor(entity)
          return (
            <View
              key={participantKey(participant, index)}
              style={[
                styles.tile,
                {
                  width: tileSize,
                  height: tileSize,
                  borderRadius: tileSize * 0.35,
                  backgroundColor: color + '22',
                },
              ]}
            >
              {showImage ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: tileSize, height: tileSize }}
                  onError={() => setFailedUrls((prev) => new Set(prev).add(avatarUrl))}
                />
              ) : (
                <Text style={[styles.initial, { color, fontSize: Math.max(8, tileSize * 0.46) }]}>
                  {getInitial(entityDisplayName(entity))}
                </Text>
              )}
            </View>
          )
        }) : (
          <View style={[styles.tile, styles.emptyTile, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
            <Text style={styles.emptyText}>#</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flexShrink: 0,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7dee8',
    backgroundColor: 'transparent',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontWeight: '700',
    lineHeight: 14,
  },
  emptyTile: {
    backgroundColor: '#e0f2fe',
  },
  emptyText: {
    color: '#0284c7',
    fontWeight: '700',
  },
})
