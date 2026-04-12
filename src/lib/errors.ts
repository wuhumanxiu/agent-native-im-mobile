import type { APIResponse, APIErrorDetail } from './types'

let _errorHandler: ((error: ParsedError) => void) | null = null

export interface ParsedError {
  message: string
  detail?: APIErrorDetail
  category?: 'auth' | 'network' | 'permission' | 'server' | 'unknown'
  guidanceKey?: string
}

/**
 * Extract a human-readable error message from an API response.
 * Handles both old format (error: string) and new structured format (error: {code, message, ...}).
 */
export function extractError(res: APIResponse): ParsedError {
  if (!res.error) return { message: 'Unknown error' }

  if (typeof res.error === 'string') {
    return classify({
      message: res.error,
    })
  }

  // Structured error
  return classify({
    message: res.error.message,
    detail: res.error,
  })
}

/**
 * Get just the error message string (backward compatible).
 */
export function getErrorMessage(res: APIResponse): string {
  return extractError(res).message
}

/**
 * Register a global error handler that gets called for all API errors.
 */
export function setGlobalErrorHandler(handler: (error: ParsedError) => void) {
  _errorHandler = handler
}

/**
 * Push an error to the global error handler if one is registered.
 */
export function reportError(error: ParsedError) {
  _errorHandler?.(error)
}

/**
 * Convenience: report from an API response if it's an error.
 */
export function reportApiError(res: APIResponse) {
  if (!res.ok) {
    reportError(extractError(res))
  }
}

export function isRetryableNetworkResponse(res: APIResponse): boolean {
  return extractError(res).category === 'network'
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return classify({ message: error.message }).category === 'network'
  }
  if (typeof error === 'string') {
    return classify({ message: error }).category === 'network'
  }
  return false
}

function classify(parsed: ParsedError): ParsedError {
  const detail = parsed.detail
  const status = detail?.status
  const code = detail?.code || ''
  const msg = parsed.message.toLowerCase()

  if (status === 401 || code.startsWith('AUTH_')) {
    return { ...parsed, category: 'auth', guidanceKey: 'error.guidance.auth' }
  }
  if (status === 403 || code.startsWith('PERM_')) {
    return { ...parsed, category: 'permission', guidanceKey: 'error.guidance.permission' }
  }
  if (status && status >= 500) {
    return { ...parsed, category: 'server', guidanceKey: 'error.guidance.server' }
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) {
    return { ...parsed, category: 'network', guidanceKey: 'error.guidance.network' }
  }
  return { ...parsed, category: 'unknown', guidanceKey: 'error.guidance.unknown' }
}
