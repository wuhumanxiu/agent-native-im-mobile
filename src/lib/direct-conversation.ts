import type { TFunction } from 'i18next'
import * as api from './api'
import { buildDirectConversationTitle } from './conversation-title'
import type { Conversation, Entity } from './types'

export function shouldReuseDirectConversation(target: Entity): boolean {
  return target.entity_type === 'user'
}

export function findExistingDirectConversation(conversations: Conversation[], myEntityId: number, targetEntityId: number): Conversation | undefined {
  return conversations
    .filter((conversation) => {
      if (conversation.conv_type !== 'direct') return false
      const participantIds = new Set((conversation.participants || []).map((participant) => participant.entity_id))
      return participantIds.has(myEntityId) && participantIds.has(targetEntityId) && participantIds.size === 2
    })
    .sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''))[0]
}

export async function openOrCreateDirectConversation(options: {
  token: string
  t: TFunction
  actingEntity: Entity
  target: Entity
  conversations: Conversation[]
  addConversation: (conversation: Conversation) => void
  mode?: 'smart' | 'existing' | 'new'
}): Promise<Conversation | null> {
  const { token, t, actingEntity, target, conversations, addConversation, mode = 'smart' } = options
  const existing = findExistingDirectConversation(conversations, actingEntity.id, target.id)
  const shouldReuse =
    mode === 'existing' || (mode === 'smart' && shouldReuseDirectConversation(target))

  if (existing && shouldReuse) return existing

  const res = await api.createConversation(token, {
    title: buildDirectConversationTitle(t, target),
    conv_type: 'direct',
    participant_ids: [target.id],
    source_entity_id: actingEntity.id === target.id ? undefined : actingEntity.id,
  })
  if (!res.ok || !res.data) return null
  addConversation(res.data)
  return res.data
}
