import * as FileSystem from 'expo-file-system/legacy'
import { Linking } from 'react-native'
import { getApiBaseUrl } from './gateway'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function absoluteFileUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (!url.startsWith('/')) return url
  return `${trimTrailingSlash(getApiBaseUrl())}${url}`
}

export function authenticatedFileUrl(url: string | undefined | null, token: string | null): string {
  const absolute = absoluteFileUrl(url)
  if (!absolute) return ''
  void token
  return absolute
}

export function normalizeAttachmentUrl(url: string | undefined | null): string {
  if (!url) return ''
  if (url.startsWith('/files/')) return url

  try {
    const parsed = new URL(url)
    const apiOrigin = new URL(getApiBaseUrl()).origin
    if (parsed.origin === apiOrigin && parsed.pathname.startsWith('/files/')) {
      return parsed.pathname
    }
  } catch {
    return url
  }

  return url
}

export function authenticatedFileHeaders(token: string | null): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export function authenticatedImageSource(url: string | undefined | null, token: string | null) {
  const uri = authenticatedFileUrl(url, token)
  const headers = authenticatedFileHeaders(token)
  if (!uri) return undefined
  return headers ? { uri, headers } : { uri }
}

function fileExtension(filename?: string | null, fallbackUrl?: string | null): string {
  const candidate = filename || fallbackUrl || ''
  const match = candidate.match(/(\.[a-zA-Z0-9]{1,10})(?:$|\?)/)
  return match?.[1] || ''
}

export async function openAuthenticatedFile(url: string | undefined | null, token: string | null, filename?: string | null): Promise<void> {
  const absolute = authenticatedFileUrl(url, token)
  if (!absolute) return

  const headers = authenticatedFileHeaders(token)
  if (!headers) {
    await Linking.openURL(absolute)
    return
  }

  const extension = fileExtension(filename, absolute)
  const localPath = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}ani-download-${Date.now()}${extension}`

  const result = await FileSystem.downloadAsync(absolute, localPath, { headers })
  await Linking.openURL(result.uri)
}
