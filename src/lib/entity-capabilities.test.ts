import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
import en from '../i18n/en.json'
import { getEntityAttachmentHint } from './entity-capabilities'
import type { Entity } from './types'

const t = i18next.createInstance()
void t.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
})

function makeBot(capabilities: string[]): Entity {
  return {
    id: 1,
    name: 'lobster',
    display_name: 'Lobster',
    entity_type: 'bot',
    metadata: { capabilities },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

describe('getEntityAttachmentHint', () => {
  it('warns when the bot is text only', () => {
    const hint = getEntityAttachmentHint(t.t.bind(t), makeBot([]), ['image'])
    expect(hint).toContain('Lobster')
    expect(hint).toContain('best with text')
  })

  it('uses softer boundary copy when the bot declares support', () => {
    const hint = getEntityAttachmentHint(t.t.bind(t), makeBot(['vision', 'pdf']), ['image', 'document'])
    expect(hint).toContain('can receive')
    expect(hint).toContain('images + documents')
  })
})
