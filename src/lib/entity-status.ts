import type { TFunction } from 'i18next'
import type { Entity, PresenceStateValue } from './types'

export type EntityPresenceSemantic = 'online' | 'offline' | 'unknown' | 'disabled' | 'pending'

export function getEntityPresenceSemantic(entity: Pick<Entity, 'status'>, presence: PresenceStateValue): EntityPresenceSemantic {
  if (entity.status === 'disabled') return 'disabled'
  if (entity.status === 'pending') return 'pending'
  return presence
}

export function getEntityStatusLabel(
  t: TFunction,
  entity: Pick<Entity, 'status'>,
  presence: PresenceStateValue,
): string {
  const semantic = getEntityPresenceSemantic(entity, presence)
  switch (semantic) {
    case 'disabled':
      return t('bot.disabled')
    case 'pending':
      return t('entityPopover.pending')
    case 'online':
      return t('common.online')
    case 'unknown':
      return t('common.unknown')
    case 'offline':
    default:
      return t('common.offline')
  }
}
