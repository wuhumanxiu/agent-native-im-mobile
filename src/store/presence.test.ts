import { describe, expect, it, beforeEach } from 'vitest'
import { usePresenceStore } from './presence'

describe('presence store', () => {
  beforeEach(() => {
    usePresenceStore.setState({
      online: new Set<number>(),
      wsConnected: false,
      lastSyncAt: null,
    })
  })

  it('replaces a refreshed subset of presence ids without clobbering others', () => {
    const { setOnline, setPresenceBatch } = usePresenceStore.getState()
    setOnline(99, true)
    setOnline(1, true)
    setOnline(2, true)

    setPresenceBatch([1, 2, 3], [2, 3])

    const online = usePresenceStore.getState().online
    expect([...online].sort((a, b) => a - b)).toEqual([2, 3, 99])
  })
})
