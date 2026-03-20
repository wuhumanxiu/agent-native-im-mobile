import type { TFunction } from 'i18next'
import type { Entity } from './types'

function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name || 'Unknown'
}

function shortStamp(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${month}${day}-${hours}${minutes}`
}

export function buildDirectConversationTitle(t: TFunction, entity: Entity): string {
  const name = entityDisplayName(entity)
  if (entity.entity_type === 'bot' || entity.entity_type === 'service') {
    const stamp = shortStamp()
    return t('newConversation.directTitleWithBot', {
      defaultValue: `${name} #${stamp}`,
      name,
      stamp,
    })
  }
  return name
}
