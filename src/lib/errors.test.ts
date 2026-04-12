import { describe, expect, it } from 'vitest'
import { isRetryableNetworkError, isRetryableNetworkResponse } from './errors'

describe('retryable network classification', () => {
  it('treats network failures as retryable', () => {
    expect(isRetryableNetworkError(new Error('Network request failed'))).toBe(true)
    expect(isRetryableNetworkResponse({ ok: false, error: 'Failed to fetch' })).toBe(true)
  })

  it('does not treat permission or rate limit responses as retryable', () => {
    expect(
      isRetryableNetworkResponse({
        ok: false,
        error: { code: 'PERM_DENIED', message: 'forbidden', status: 403, path: '/api/v1/messages/send' },
      }),
    ).toBe(false)
    expect(
      isRetryableNetworkResponse({
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many requests', status: 429, path: '/api/v1/messages/send' },
      }),
    ).toBe(false)
  })
})
