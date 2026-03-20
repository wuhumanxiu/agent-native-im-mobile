import type { TFunction } from 'i18next'
import type { Entity } from './types'

type CapabilitySupport = {
  text: boolean
  images: boolean
  audio: boolean
  video: boolean
  documents: boolean
}

function readCapabilityTokens(entity: Entity): string[] {
  const metadata = entity.metadata as Record<string, unknown> | undefined
  const capabilities = Array.isArray(metadata?.capabilities) ? metadata?.capabilities : []
  const tags = Array.isArray(metadata?.tags) ? metadata?.tags : []
  return [...capabilities, ...tags]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase())
}

export function getEntityCapabilitySupport(entity: Entity): CapabilitySupport {
  const tokens = readCapabilityTokens(entity)
  const hasAny = (needles: string[]) => needles.some((needle) => tokens.some((token) => token.includes(needle)))

  const multimodal = hasAny(['multimodal', 'vision'])
  const documents = hasAny(['document', 'pdf', 'office', 'text'])

  return {
    text: true,
    images: multimodal || hasAny(['image', 'photo']),
    audio: multimodal || hasAny(['audio', 'speech', 'voice']),
    video: multimodal || hasAny(['video']),
    documents: documents || multimodal,
  }
}

export function getEntityCapabilityChips(t: TFunction, entity: Entity): string[] {
  const support = getEntityCapabilitySupport(entity)
  const chips = [t('bot.capabilityText')]
  if (support.images) chips.push(t('bot.capabilityImages'))
  if (support.audio) chips.push(t('bot.capabilityAudio'))
  if (support.video) chips.push(t('bot.capabilityVideo'))
  if (support.documents) chips.push(t('bot.capabilityPdf'))
  return chips
}

export function getEntityCapabilitySummary(t: TFunction, entity: Entity): string {
  const support = getEntityCapabilitySupport(entity)
  if (support.images && support.audio && support.video && support.documents) {
    return t('bot.capabilitySummary')
  }
  if (support.images || support.audio || support.video || support.documents) {
    return t('bot.capabilityPartial')
  }
  return t('bot.capabilityTextOnly')
}
