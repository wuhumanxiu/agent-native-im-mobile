import type { Entity } from './types'

export function getInitials(name: string): string {
  const firstChar = name.trim().charAt(0)
  if (firstChar) return firstChar.toUpperCase()
  return ''
}

export function entityDisplayName(entity?: Entity | null): string {
  if (!entity) return 'Unknown'
  return entity.display_name || entity.name
}

export function isBotOrService(entity?: { entity_type?: string } | null): boolean {
  return entity?.entity_type === 'bot' || entity?.entity_type === 'service'
}

export function entityColor(entity?: Entity | null): string {
  if (!entity) return '#6366f1'
  if (entity.entity_type === 'bot') return '#a78bfa'
  if (entity.entity_type === 'service') return '#f59e0b'
  const colors = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c']
  let hash = 0
  for (const ch of entity.name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  return colors[Math.abs(hash) % colors.length]
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (diffDays === 0) return timeStr
  if (diffDays === 1) return `Yesterday ${timeStr}`
  if (diffDays < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${timeStr}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + timeStr
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

/**
 * Append JWT token to /files/ URLs for authenticated access.
 * Non-file URLs (http://, https://, data:, etc.) are returned unchanged.
 */
export function authenticatedFileUrl(url: string | undefined | null, token: string | null, baseUrl?: string): string {
  if (!url || !token) return url ?? ''
  // Only modify relative /files/ paths served by our backend
  if (!url.startsWith('/files/')) return url
  const base = baseUrl || 'https://ani-web.51pwd.com'
  const separator = url.includes('?') ? '&' : '?'
  return `${base}${url}${separator}token=${encodeURIComponent(token)}`
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '\u2026'
}

/**
 * Returns a human-readable date separator label.
 * "Today", "Yesterday", or a formatted date.
 */
export function formatDateSeparator(iso: string, todayLabel = 'Today', yesterdayLabel = 'Yesterday'): string {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (today.getTime() - msgDay.getTime()) / 86400000

  if (diff === 0) return todayLabel
  if (diff === 1) return yesterdayLabel
  if (diff < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

/**
 * Check if a message can be revoked (within 2 minutes of creation).
 */
export function canRevokeMessage(createdAt: string): boolean {
  const twoMinMs = 2 * 60 * 1000
  return Date.now() - new Date(createdAt).getTime() < twoMinMs
}
