import type { TFunction } from 'i18next'
import type { Entity } from './types'

export type EntityPresenceSemantic = 'online' | 'offline' | 'disabled' | 'pending'

export function getEntityPresenceSemantic(entity: Pick<Entity, 'status'>, isOnline: boolean): EntityPresenceSemantic {
  if (entity.status === 'disabled') return 'disabled'
  if (entity.status === 'pending') return 'pending'
  return isOnline ? 'online' : 'offline'
}

export function getEntityStatusLabel(
  t: TFunction,
  entity: Pick<Entity, 'status'>,
  isOnline: boolean,
): string {
  const semantic = getEntityPresenceSemantic(entity, isOnline)
  switch (semantic) {
    case 'disabled':
      return t('bot.disabled')
    case 'pending':
      return t('entityPopover.pending')
    case 'online':
      return t('common.online')
    case 'offline':
    default:
      return t('common.offline')
  }
}
