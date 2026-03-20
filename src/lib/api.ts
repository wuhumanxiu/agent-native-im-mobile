import type {
  APIResponse, LoginResponse, Entity, Conversation,
  MessagesResponse, SearchResponse, GlobalSearchResponse, Message,
  Task, ConversationMemory, ChangeRequest, EntitySelfCheck, EntityDiagnostics,
} from './types'
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { getSessionHooks } from './auth-session'
import { reportApiError } from './errors'
import { API_BASE_URL } from './constants'

let baseUrl = API_BASE_URL
let refreshInFlight: Promise<string | null> | null = null

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/+$/, '')
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function parseAPIResponse<T>(res: Response, quiet = false): Promise<APIResponse<T>> {
  try {
    const parsed = await res.json()
    if (!parsed.ok && !quiet) reportApiError(parsed)
    return parsed
  } catch {
    const fallback = { ok: false, error: `HTTP ${res.status}` } as APIResponse<T>
    if (!quiet) reportApiError(fallback)
    return fallback
  }
}

async function fetchWithAuthRetry<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
  retry = true,
): Promise<APIResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && retry && path !== '/api/v1/auth/refresh') {
    const nextToken = await tryRefreshToken(token)
    if (nextToken) {
      return fetchWithAuthRetry(method, path, nextToken, body, false)
    }
  }

  return parseAPIResponse<T>(res)
}

async function request<T>(method: string, path: string, token?: string, body?: unknown): Promise<APIResponse<T>> {
  if (token) {
    return fetchWithAuthRetry<T>(method, path, token, body)
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return parseAPIResponse<T>(res)
}

/** Like request() but suppresses global error toasts -- use for probing/optional endpoints */
async function requestQuiet<T>(method: string, path: string, token?: string, body?: unknown): Promise<APIResponse<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return parseAPIResponse<T>(res, true)
}

async function tryRefreshToken(oldToken: string): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: authHeaders(oldToken),
      })
      const payload = await parseAPIResponse<{ token: string }>(res)
      if (res.ok && payload.ok && payload.data?.token) {
        const newToken = payload.data.token
        const hooks = getSessionHooks()
        hooks?.setToken(newToken)
        return newToken
      }

      // Only auth failures should force logout.
      if (res.status === 401 || res.status === 403) {
        getSessionHooks()?.onAuthFailure()
      }

      return null
    } catch {
      // Network/server issues: keep session and let caller retry later.
      return null
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

// Auth
export const login = (username: string, password: string) =>
  request<LoginResponse>('POST', '/api/v1/auth/login', undefined, { username, password })

export const register = (username: string, password: string, email?: string, displayName?: string) =>
  request<{ token: string; entity: Entity }>('POST', '/api/v1/auth/register', undefined, { username, password, email, display_name: displayName })

export const getMe = (token: string) =>
  request<Entity>('GET', '/api/v1/me', token)

export const refreshToken = (token: string) =>
  request<{ token: string }>('POST', '/api/v1/auth/refresh', token)

export const logout = (token: string) =>
  request('POST', '/api/v1/auth/logout', token)

// Conversations
export const listConversations = (token: string, archived = false) =>
  request<Conversation[]>('GET', `/api/v1/conversations${archived ? '?archived=true' : ''}`, token)

export const getConversation = (token: string, id: number) =>
  request<Conversation>('GET', `/api/v1/conversations/${id}`, token)

export const getConversationByPublicId = (token: string, publicId: string) =>
  request<Conversation>('GET', `/api/v1/conversations/public/${encodeURIComponent(publicId)}`, token)

export const createConversation = (token: string, data: { title: string; conv_type?: string; participant_ids?: number[] }) =>
  request<Conversation>('POST', '/api/v1/conversations', token, data)

export const updateConversation = (token: string, id: number, data: { title?: string; description?: string; prompt?: string }) =>
  request<Conversation>('PUT', `/api/v1/conversations/${id}`, token, data)

// Participants
export const addParticipant = (token: string, convId: number, entityId: number, role?: string) =>
  request('POST', `/api/v1/conversations/${convId}/participants`, token, { entity_id: entityId, role })

export const removeParticipant = (token: string, convId: number, entityId: number) =>
  request('DELETE', `/api/v1/conversations/${convId}/participants/${entityId}`, token)

export const updateParticipantRole = (token: string, convId: number, entityId: number, role: string) =>
  request('PUT', `/api/v1/conversations/${convId}/participants/${entityId}`, token, { role })

export const updateSubscription = (token: string, convId: number, mode: string, contextWindow?: number) =>
  request('PUT', `/api/v1/conversations/${convId}/subscription`, token, {
    mode,
    ...(contextWindow !== undefined && { context_window: contextWindow }),
  })

export const markAsRead = (token: string, convId: number, messageId: number) =>
  request('POST', `/api/v1/conversations/${convId}/read`, token, { message_id: messageId })

// Messages
export const listMessages = (token: string, convId: number, before?: number, limit = 30) => {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', String(before))
  return request<MessagesResponse>('GET', `/api/v1/conversations/${convId}/messages?${params}`, token)
}

export const sendMessage = (token: string, msg: {
  conversation_id: number
  content_type?: string
  layers: Record<string, unknown>
  attachments?: unknown[]
  mentions?: number[]
  reply_to?: number
}) => request<Message>('POST', '/api/v1/messages/send', token, msg)

export const revokeMessage = (token: string, msgId: number) =>
  request('DELETE', `/api/v1/messages/${msgId}`, token)

export const searchMessages = (token: string, convId: number, query: string, limit = 20) =>
  request<SearchResponse>('GET', `/api/v1/conversations/${convId}/search?q=${encodeURIComponent(query)}&limit=${limit}`, token)

export const searchGlobal = (token: string, query: string, limit = 20, offset = 0) =>
  request<GlobalSearchResponse>('GET', `/api/v1/messages/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`, token)

// Entities
export const listEntities = (token: string) =>
  request<Entity[]>('GET', '/api/v1/entities', token)

export const createEntity = (token: string, name: string, metadata?: Record<string, unknown>) =>
  request<{ entity: Entity; api_key: string; bootstrap_key?: string; markdown_doc: string }>('POST', '/api/v1/entities', token, {
    name,
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
  })

export const deleteEntity = (token: string, id: number) =>
  request('DELETE', `/api/v1/entities/${id}`, token)

export const approveConnection = (token: string, id: number) =>
  request('POST', `/api/v1/entities/${id}/approve`, token)

export const reactivateEntity = (token: string, id: number) =>
  request<Entity>('POST', `/api/v1/entities/${id}/reactivate`, token)

export const updateEntity = (token: string, id: number, data: { display_name?: string; avatar_url?: string; metadata?: Record<string, unknown> }) =>
  request<Entity>('PUT', `/api/v1/entities/${id}`, token, data)

export const getEntityStatus = (token: string, id: number) =>
  request<{ online: boolean; last_seen?: string }>('GET', `/api/v1/entities/${id}/status`, token)

export const getEntityCredentials = (token: string, id: number) =>
  request<{ entity_id: number; has_bootstrap: boolean; has_api_key: boolean; bootstrap_prefix: string }>(
    'GET', `/api/v1/entities/${id}/credentials`, token,
  )

export const getEntitySelfCheck = (token: string, id: number) =>
  request<EntitySelfCheck>('GET', `/api/v1/entities/${id}/self-check`, token)

export const getEntityDiagnostics = (token: string, id: number) =>
  request<EntityDiagnostics>('GET', `/api/v1/entities/${id}/diagnostics`, token)

export const regenerateEntityToken = (token: string, id: number) =>
  request<{ message: string; entity: Entity; api_key: string; disconnected: number }>(
    'POST',
    `/api/v1/entities/${id}/regenerate-token`,
    token,
  )

export const batchPresence = (token: string, entityIds: number[]) =>
  request<{ presence: Record<string, boolean> }>('POST', '/api/v1/presence/batch', token, { entity_ids: entityIds })

export const updateProfile = (token: string, data: { display_name?: string; avatar_url?: string; email?: string }) =>
  request<Entity>('PUT', '/api/v1/me', token, data)

// Files
export async function uploadFile(token: string, uri: string, filename: string, mimeType: string): Promise<APIResponse<{ url: string }>> {
  const uploadUrl = `${baseUrl}/api/v1/files/upload`

  try {
    if (Platform.OS !== 'web') {
      const res = await FileSystem.uploadAsync(uploadUrl, uri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        mimeType,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 413) {
        return { ok: false, error: 'File too large' } as APIResponse<{ url: string }>
      }
      try {
        const parsed = JSON.parse(res.body) as APIResponse<{ url: string }>
        if (!parsed.ok) reportApiError(parsed)
        return parsed
      } catch {
        const fallback = { ok: false, error: `HTTP ${res.status}` } as APIResponse<{ url: string }>
        reportApiError(fallback)
        return fallback
      }
    }

    const form = new FormData()
    form.append('file', {
      uri,
      name: filename,
      type: mimeType,
    } as unknown as Blob)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: controller.signal,
      })
      if (res.status === 413) {
        return { ok: false, error: 'File too large' } as APIResponse<{ url: string }>
      }
      return parseAPIResponse<{ url: string }>(res)
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Upload timeout'
      : String(err)
    return { ok: false, error: message } as APIResponse<{ url: string }>
  }
}

// Push notifications (quiet -- endpoint may not exist)
export const getVapidKey = () =>
  requestQuiet<{ public_key: string }>('GET', '/api/v1/push/vapid-key')

export const registerPush = (token: string, data: { endpoint: string; key_p256dh: string; key_auth: string }) =>
  request('POST', '/api/v1/push/subscribe', token, data)

export const unregisterPush = (token: string, endpoint: string) =>
  request('POST', '/api/v1/push/unsubscribe', token, { endpoint })

// Conversation lifecycle
export const leaveConversation = (token: string, convId: number) =>
  request('POST', `/api/v1/conversations/${convId}/leave`, token)

export const archiveConversation = (token: string, convId: number) =>
  request('POST', `/api/v1/conversations/${convId}/archive`, token)

export const unarchiveConversation = (token: string, convId: number) =>
  request('POST', `/api/v1/conversations/${convId}/unarchive`, token)

export const pinConversation = (token: string, convId: number) =>
  request('POST', `/api/v1/conversations/${convId}/pin`, token)

export const unpinConversation = (token: string, convId: number) =>
  request('POST', `/api/v1/conversations/${convId}/unpin`, token)

// Interaction response
export const respondToInteraction = (token: string, msgId: number, value: string) =>
  request('POST', `/api/v1/messages/${msgId}/respond`, token, { value })

// Invite links
export const createInviteLink = (token: string, convId: number, data?: { max_uses?: number; expires_in?: number }) =>
  request<{ id: number; code: string; conversation_id: number }>('POST', `/api/v1/conversations/${convId}/invite`, token, data)

export const listInviteLinks = (token: string, convId: number) =>
  request<{ id: number; code: string; use_count: number; max_uses: number; expires_at?: string }[]>('GET', `/api/v1/conversations/${convId}/invites`, token)

export const getInviteInfo = (token: string, code: string) =>
  request<{ invite: unknown; conversation: unknown }>('GET', `/api/v1/invite/${code}`, token)

export const joinViaInvite = (token: string, code: string) =>
  request('POST', `/api/v1/invite/${code}/join`, token)

export const deleteInviteLink = (token: string, id: number) =>
  request('DELETE', `/api/v1/invites/${id}`, token)

// Reactions
export const toggleReaction = (token: string, msgId: number, emoji: string) =>
  request<{ message_id: number; reactions: { emoji: string; count: number; entity_ids: number[] }[] }>(
    'POST', `/api/v1/messages/${msgId}/reactions`, token, { emoji },
  )

// Message edit
export const editMessage = (token: string, msgId: number, text: string) =>
  request<Message>('PUT', `/api/v1/messages/${msgId}`, token, { layers: { summary: text } })

// Tasks
export const createTask = (token: string, convId: number, data: { title: string; description?: string; assignee_id?: number; priority?: string; due_date?: string; parent_task_id?: number }) =>
  request<Task>('POST', `/api/v1/conversations/${convId}/tasks`, token, data)

export const listTasks = (token: string, convId: number, status?: string) =>
  request<Task[]>('GET', `/api/v1/conversations/${convId}/tasks${status ? `?status=${status}` : ''}`, token)

export const getTask = (token: string, taskId: number) =>
  request<Task>('GET', `/api/v1/tasks/${taskId}`, token)

export const updateTask = (token: string, taskId: number, data: { title?: string; description?: string; status?: string; priority?: string; assignee_id?: number; due_date?: string }) =>
  request<Task>('PUT', `/api/v1/tasks/${taskId}`, token, data)

export const deleteTask = (token: string, taskId: number) =>
  request('DELETE', `/api/v1/tasks/${taskId}`, token)

// Memories
export const listMemories = (token: string, convId: number) =>
  request<{ memories: ConversationMemory[]; prompt: string }>('GET', `/api/v1/conversations/${convId}/memories`, token)

export const upsertMemory = (token: string, convId: number, key: string, content: string) =>
  request<ConversationMemory>('POST', `/api/v1/conversations/${convId}/memories`, token, { key, content })

export const deleteMemory = (token: string, convId: number, memId: number) =>
  request('DELETE', `/api/v1/conversations/${convId}/memories/${memId}`, token)

// Change Requests
export const createChangeRequest = (token: string, convId: number, field: string, newValue: string) =>
  request<ChangeRequest>('POST', `/api/v1/conversations/${convId}/change-requests`, token, { field, new_value: newValue })

export const listChangeRequests = (token: string, convId: number, status?: string) =>
  request<ChangeRequest[]>('GET', `/api/v1/conversations/${convId}/change-requests${status ? `?status=${status}` : ''}`, token)

export const approveChangeRequest = (token: string, convId: number, reqId: number) =>
  request('POST', `/api/v1/conversations/${convId}/change-requests/${reqId}/approve`, token)

export const rejectChangeRequest = (token: string, convId: number, reqId: number) =>
  request('POST', `/api/v1/conversations/${convId}/change-requests/${reqId}/reject`, token)

// Change password
export const changePassword = (token: string, oldPassword: string, newPassword: string) =>
  request('PUT', '/api/v1/me/password', token, { old_password: oldPassword, new_password: newPassword })

// Devices
export const listDevices = (token: string) =>
  request<{ devices: { device_id: string; device_info: string; entity_id: number }[] }>('GET', '/api/v1/me/devices', token)

export const kickDevice = (token: string, deviceId: string) =>
  request('DELETE', `/api/v1/me/devices/${encodeURIComponent(deviceId)}`, token)

// Updates (long polling fallback)
export const getUpdates = (token: string, since?: string) =>
  request<{ events: unknown[] }>('GET', `/api/v1/updates${since ? `?since=${since}` : ''}`, token)
