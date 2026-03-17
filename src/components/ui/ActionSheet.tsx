import React from 'react'
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'

export interface ActionSheetOption {
  label: string
  icon?: React.ReactNode
  onPress: () => void
  destructive?: boolean
}

interface Props {
  visible: boolean
  onClose: () => void
  title?: string
  options: ActionSheetOption[]
}

export function ActionSheet({ visible, onClose, title, options }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          {title && <Text style={styles.title}>{title}</Text>}
          {options.map((option, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
                i < options.length - 1 && styles.optionBorder,
              ]}
              onPress={() => {
                option.onPress()
                onClose()
              }}
            >
              {option.icon && <View style={styles.optionIcon}>{option.icon}</View>}
              <Text
                style={[
                  styles.optionLabel,
                  option.destructive && styles.optionDestructive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
          <View style={styles.cancelSeparator} />
          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && styles.optionPressed]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34, // safe area
    paddingTop: 8,
  },
  title: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionPressed: {
    backgroundColor: '#f1f5f9',
  },
  optionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    color: '#1e293b',
  },
  optionDestructive: {
    color: '#ef4444',
  },
  cancelSeparator: {
    height: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },
})
