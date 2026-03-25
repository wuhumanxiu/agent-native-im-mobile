import { beforeEach, describe, expect, it, vi } from 'vitest'

const { backing, setBaseUrl } = vi.hoisted(() => ({
  backing: new Map<string, string>(),
  setBaseUrl: vi.fn(),
}))

vi.mock('./storage', () => ({
  storage: {
    getString: (key: string) => backing.get(key),
    set: (key: string, value: string) => { backing.set(key, value) },
    delete: (key: string) => { backing.delete(key) },
  },
  loadSetting: <T,>(key: string, fallback: T) => {
    const raw = backing.get(key)
    return raw ? JSON.parse(raw) as T : fallback
  },
  saveSetting: (key: string, value: unknown) => { backing.set(key, JSON.stringify(value)) },
}))

vi.mock('./api', () => ({
  setBaseUrl,
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: 'https://agent-native.im',
      },
    },
  },
}))

import { clearGatewayUrl, getGatewayUrl, normalizeGatewayUrl, persistGatewayUrl } from './gateway'

describe('mobile gateway helpers', () => {
  beforeEach(() => {
    backing.clear()
    setBaseUrl.mockReset()
  })

  it('normalizes and stores a custom gateway', () => {
    const saved = persistGatewayUrl('custom.example.com/')
    expect(saved).toBe('https://custom.example.com')
    expect(getGatewayUrl()).toBe('https://custom.example.com')
    expect(setBaseUrl).toHaveBeenLastCalledWith('https://custom.example.com')
  })

  it('clears back to the default gateway', () => {
    persistGatewayUrl('custom.example.com')
    clearGatewayUrl()
    expect(getGatewayUrl()).toBe('https://agent-native.im')
    expect(setBaseUrl).toHaveBeenLastCalledWith('https://agent-native.im')
  })

  it('rejects unsupported protocols', () => {
    expect(() => normalizeGatewayUrl('ftp://example.com')).toThrow()
  })
})
