import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { openOrCreateDirectConversation } from './direct-conversation'

vi.mock('./api', () => ({
  createConversation: vi.fn(),
}))

describe('mobile direct-conversation helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('passes source_entity_id when acting as an owned bot', async () => {
    vi.mocked(api.createConversation).mockResolvedValue({
      ok: true,
      data: {
        id: 42,
        conv_type: 'direct',
        title: 'Bot -> User',
        description: '',
        prompt: '',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
    } as never)

    const addConversation = vi.fn()
    await openOrCreateDirectConversation({
      token: 'token',
      t: ((value: string) => value) as never,
      actingEntity: {
        id: 77,
        entity_type: 'bot',
        name: 'owned_helper',
        display_name: 'Owned Helper',
        status: 'active',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
      target: {
        id: 9,
        entity_type: 'user',
        name: 'alice',
        display_name: 'Alice',
        status: 'active',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
      conversations: [],
      addConversation,
      mode: 'new',
    })

    expect(api.createConversation).toHaveBeenCalledWith('token', expect.objectContaining({
      conv_type: 'direct',
      participant_ids: [9],
      source_entity_id: 77,
    }))
  })
})
