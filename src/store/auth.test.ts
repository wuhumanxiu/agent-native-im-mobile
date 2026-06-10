import { afterEach, describe, expect, it, vi } from 'vitest'

describe('auth store hydration', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('../lib/storage')
  })

  it('marks the session checked when storage hydration fails', async () => {
    vi.doMock('../lib/storage', () => ({
      hydrateStorage: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      storage: {
        getString: vi.fn(() => undefined),
        set: vi.fn(),
        delete: vi.fn(),
      },
    }))

    const { useAuthStore } = await import('./auth')

    await useAuthStore.getState().hydrate()

    expect(useAuthStore.getState().sessionChecked).toBe(true)
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().entity).toBeNull()
  })

  it('clears an incomplete restored session without an entity', async () => {
    const deleteItem = vi.fn()
    vi.doMock('../lib/storage', () => ({
      hydrateStorage: vi.fn().mockResolvedValue(undefined),
      storage: {
        getString: vi.fn((key: string) => (key === 'aim_token' ? 'stale-token' : undefined)),
        set: vi.fn(),
        delete: deleteItem,
      },
    }))

    const { useAuthStore } = await import('./auth')

    await useAuthStore.getState().hydrate()

    expect(useAuthStore.getState().sessionChecked).toBe(true)
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().entity).toBeNull()
    expect(deleteItem).toHaveBeenCalledWith('aim_token')
    expect(deleteItem).toHaveBeenCalledWith('aim_entity')
  })
})
