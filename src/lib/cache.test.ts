import { beforeEach, describe, expect, it, vi } from 'vitest'

const backing = new Map<string, string>()

vi.mock('./storage', () => ({
  storage: {
    getString: (key: string) => backing.get(key),
    set: (key: string, value: string) => { backing.set(key, value) },
    delete: (key: string) => { backing.delete(key) },
  },
}))

import {
  cacheConversations,
  cacheConversationContext,
  cacheMessages,
  getCachedConversations,
  getCachedConversationContext,
  getCachedMessages,
  enqueueOutboxMessage,
  listOutboxMessages,
  listOutboxMessagesByConversation,
  updateOutboxMessage,
  deleteOutboxMessage,
} from './cache'

describe('mobile cache helpers', () => {
  beforeEach(() => {
    backing.clear()
  })

  it('stores and restores cached conversations', () => {
    cacheConversations([{ id: 1, title: 'Roadmap', conv_type: 'group' } as never])
    expect(getCachedConversations()).toHaveLength(1)
    expect(getCachedConversations()[0]?.id).toBe(1)
  })

  it('stores and restores cached messages', () => {
    cacheMessages(12, [{ id: 9, conversation_id: 12, created_at: '2026-03-22T00:00:00Z', sender_id: 1, content_type: 'text', layers: { summary: 'hi' } } as never])
    expect(getCachedMessages(12)).toHaveLength(1)
    expect(getCachedMessages(12)[0]?.id).toBe(9)
  })

  it('stores and restores cached conversation context', () => {
    cacheConversationContext(7, {
      prompt: 'remember the roadmap',
      memories: [{ id: 1, key: 'priority', content: 'ship mobile offline mode' } as never],
      tasks: [{ id: 11, title: 'Offline baseline', status: 'open' } as never],
      updated_at: '2026-03-22T00:00:00Z',
    })
    expect(getCachedConversationContext(7)?.prompt).toBe('remember the roadmap')
    expect(getCachedConversationContext(7)?.memories).toHaveLength(1)
    expect(getCachedConversationContext(7)?.tasks).toHaveLength(1)
  })

  it('persists and updates outbox messages', () => {
    enqueueOutboxMessage({
      id: 'tmp-1',
      temp_id: 'tmp-1',
      conversation_id: 5,
      text: 'hello',
      created_at: '2026-03-22T00:00:00Z',
      sync_state: 'queued',
    })
    expect(listOutboxMessages()).toHaveLength(1)
    expect(listOutboxMessagesByConversation(5)).toHaveLength(1)

    updateOutboxMessage('tmp-1', { sync_state: 'failed', last_error: 'network' })
    expect(listOutboxMessages()[0]?.sync_state).toBe('failed')
    expect(listOutboxMessages()[0]?.last_error).toBe('network')

    deleteOutboxMessage('tmp-1')
    expect(listOutboxMessages()).toHaveLength(0)
  })
})
