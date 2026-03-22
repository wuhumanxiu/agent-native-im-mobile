import type { TFunction } from 'i18next'
import type { Entity } from './types'

type CapabilitySupport = {
  text: boolean
  images: boolean
  audio: boolean
  video: boolean
  documents: boolean
}

export type AttachmentCapabilityKind = 'image' | 'audio' | 'video' | 'document'

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

function getAttachmentKindLabel(t: TFunction, kind: AttachmentCapabilityKind): string {
  switch (kind) {
    case 'image':
      return t('composer.kindImage')
    case 'audio':
      return t('composer.kindAudio')
    case 'video':
      return t('composer.kindVideo')
    case 'document':
    default:
      return t('composer.kindDocument')
  }
}

function joinKinds(t: TFunction, kinds: AttachmentCapabilityKind[]): string {
  const labels = Array.from(new Set(kinds)).map((kind) => getAttachmentKindLabel(t, kind))
  if (labels.length <= 1) return labels[0] || t('composer.kindDocument')
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} + ${labels[labels.length - 1]}`
}

export function getEntityAttachmentHint(
  t: TFunction,
  entity: Entity | null | undefined,
  kinds: AttachmentCapabilityKind[],
): string | null {
  if (!entity || kinds.length === 0) return null
  const support = getEntityCapabilitySupport(entity)
  const unsupported = kinds.some((kind) => {
    if (kind === 'image') return !support.images
    if (kind === 'audio') return !support.audio
    if (kind === 'video') return !support.video
    return !support.documents
  })
  const name = entity.display_name || entity.name
  const kindLabel = joinKinds(t, kinds)
  return unsupported
    ? t('composer.botCapabilityLimited', { name, kinds: kindLabel })
    : t('composer.botCapabilityBoundary', { name, kinds: kindLabel })
}
