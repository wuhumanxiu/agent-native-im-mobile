import React from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useThemeColors } from '../../lib/theme'
import { EntityAvatar } from '../ui/EntityAvatar'
import type { Entity } from '../../lib/types'

interface Props {
  entity?: Entity
}

export function ThinkingBubble({ entity }: Props) {
  const colors = useThemeColors()
  const displayName = entity?.display_name || entity?.name

  return (
    <View style={styles.row}>
      <EntityAvatar entity={entity} size="sm" />

      <View style={styles.column}>
        {displayName ? (
          <View style={styles.metaRow}>
            <Text style={[styles.senderName, { color: colors.accent }]}>
              {displayName}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.bg,
              borderColor: colors.border,
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    maxWidth: '85%',
  },
  column: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '500',
  },
  bubble: {
    minHeight: 44,
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
})
