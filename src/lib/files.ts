import { API_BASE_URL } from './constants'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function absoluteFileUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (!url.startsWith('/')) return url
  return `${trimTrailingSlash(API_BASE_URL)}${url}`
}

export function authenticatedFileUrl(url: string | undefined | null, token: string | null): string {
  const absolute = absoluteFileUrl(url)
  if (!absolute) return ''
  if (!token) return absolute

  try {
    const parsed = new URL(absolute)
    if (!parsed.pathname.startsWith('/files/')) return absolute
    parsed.searchParams.set('token', token)
    return parsed.toString()
  } catch {
    return absolute
  }
}

export function normalizeAttachmentUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (url.startsWith('/files/')) return url

  try {
    const parsed = new URL(url)
    const apiOrigin = new URL(API_BASE_URL).origin
    if (parsed.origin === apiOrigin && parsed.pathname.startsWith('/files/')) {
      return parsed.pathname
    }
  } catch {
    return url
  }

  return url
}
