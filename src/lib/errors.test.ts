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
        error: {
          code: 'PERM_DENIED',
          message: 'forbidden',
          request_id: 'req-1',
          status: 403,
          timestamp: new Date(0).toISOString(),
          method: 'POST',
          path: '/api/v1/messages/send',
        },
      }),
    ).toBe(false)
    expect(
      isRetryableNetworkResponse({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'too many requests',
          request_id: 'req-2',
          status: 429,
          timestamp: new Date(0).toISOString(),
          method: 'POST',
          path: '/api/v1/messages/send',
        },
      }),
    ).toBe(false)
  })
})
