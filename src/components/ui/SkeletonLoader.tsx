import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'

type Variant = 'conversation-list' | 'chat-messages'

interface Props {
  variant: Variant
  count?: number
}

function ShimmerBox({ width, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={{
        width: width as number,
        height,
        borderRadius,
        backgroundColor: '#e2e8f0',
        opacity,
      }}
    />
  )
}

function ConversationItemSkeleton() {
  return (
    <View style={skeletonStyles.convItem}>
      <ShimmerBox width={40} height={40} borderRadius={9999} />
      <View style={skeletonStyles.convContent}>
        <View style={skeletonStyles.convRow}>
          <ShimmerBox width={120} height={14} />
          <ShimmerBox width={40} height={10} />
        </View>
        <ShimmerBox width={180} height={12} />
      </View>
    </View>
  )
}

function MessageBubbleSkeleton({ align }: { align: 'left' | 'right' }) {
  const isRight = align === 'right'
  return (
    <View style={[skeletonStyles.msgRow, isRight && skeletonStyles.msgRowRight]}>
      {!isRight && <ShimmerBox width={32} height={32} borderRadius={9999} />}
      <View style={[skeletonStyles.msgBubble, isRight ? skeletonStyles.msgBubbleRight : skeletonStyles.msgBubbleLeft]}>
        {!isRight && <ShimmerBox width={60} height={10} />}
        <ShimmerBox width={isRight ? 140 : 200} height={14} />
        <ShimmerBox width={isRight ? 80 : 120} height={14} />
      </View>
    </View>
  )
}

const MESSAGE_ALIGNS: Array<'left' | 'right'> = ['left', 'right', 'left', 'left', 'right', 'left']

export function SkeletonLoader({ variant, count }: Props) {
  switch (variant) {
    case 'conversation-list': {
      const n = count ?? 7
      return (
        <View style={skeletonStyles.listContainer}>
          {Array.from({ length: n }).map((_, i) => (
            <ConversationItemSkeleton key={i} />
          ))}
        </View>
      )
    }
    case 'chat-messages': {
      const n = count ?? 6
      return (
        <View style={skeletonStyles.chatContainer}>
          {Array.from({ length: n }).map((_, i) => (
            <MessageBubbleSkeleton key={i} align={MESSAGE_ALIGNS[i % MESSAGE_ALIGNS.length]} />
          ))}
        </View>
      )
    }
  }
}

const skeletonStyles = StyleSheet.create({
  listContainer: {
    gap: 2,
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  convContent: {
    flex: 1,
    gap: 6,
  },
  convRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  msgRowRight: {
    flexDirection: 'row-reverse',
  },
  msgBubble: {
    gap: 6,
    padding: 12,
    borderRadius: 20,
    maxWidth: '75%',
  },
  msgBubbleLeft: {
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 6,
  },
  msgBubbleRight: {
    backgroundColor: '#e0e7ff',
    borderTopRightRadius: 6,
  },
})
