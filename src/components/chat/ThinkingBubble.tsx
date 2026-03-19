import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { useThemeColors } from '../../lib/theme'
import { EntityAvatar } from '../ui/EntityAvatar'
import type { Entity } from '../../lib/types'

interface Props {
  entity?: Entity
}

export function ProcessingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current
  const dot2 = useRef(new Animated.Value(0.3)).current
  const dot3 = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      )

    const a1 = animateDot(dot1, 0)
    const a2 = animateDot(dot2, 200)
    const a3 = animateDot(dot3, 400)
    a1.start()
    a2.start()
    a3.start()
    return () => { a1.stop(); a2.stop(); a3.stop() }
  }, [dot1, dot2, dot3])

  return (
    <View style={styles.dotsContainer}>
      {[dot1, dot2, dot3].map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: dot,
            },
          ]}
        />
      ))}
    </View>
  )
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
          <ProcessingDots color={colors.accent} />
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
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
})
