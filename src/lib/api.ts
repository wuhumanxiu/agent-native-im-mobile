import type {
  APIResponse, LoginResponse, Entity, Conversation,
  MessagesResponse, SearchResponse, Message, AdminStats,
  Task, ConversationMemory, ChangeRequest, EntitySelfCheck, EntityDiagnostics,
} from './types'

export const BASE_URL = 'https://ani-web.51pwd.com'

let baseUrl = BASE_URL

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/+$/, '')
}

export function getBaseUrl(): string {
  return baseUrl
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function parseAPIResponse<T>(res: Response): Promise<APIResponse<T>> {
  try {
    const parsed = await res.json()
    return parsed
  } catch {
    return { ok: false, error: `HTTP ${res.status}` } as APIResponse<T>
  }
}

async function request<T>(method: string, path: string, token?: string, body?: unknown): Promise<APIResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return parseAPIResponse<T>(res)
}

async function requestQuiet<T>(method: string, path: string, token?: string, body?: unknown): Promise<APIResponse<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return parseAPIResponse<T>(res)
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

// Conversations
export const listConversations = (token: string, archived = false) =>
  request<Conversation[]>('GET', `/api/v1/conversations${archived ? '?archived=true' : ''}`, token)

export const getConversation = (token: string, id: number) =>
  request<Conversation>('GET', `/api/v1/conversations/${id}`, token)

export const createConversation = (token: string, data: { title: string; conv_type?: string; participant_ids?: number[] }) =>
  request<Conversation>('POST', '/api/v1/conversations', token, data)

export const updateConversation = (token: string, id: number, data: { title?: string; description?: string; prompt?: string }) =>
  request<Conversation>('PUT', `/api/v1/conversations/${id}`, token, data)

// Participants
export const addParticipant = (token: string, convId: number, entityId: number, role?: string) =>
  request('POST', `/api/v1/conversations/${convId}/participants`, token, { entity_id: entityId, role })

export const removeParticipant = (token: string, convId: number, entityId: number) =>
  request('DELETE', `/api/v1/conversations/${convId}/participants/${entityId}`, token)

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

export const batchPresence = (token: string, entityIds: number[]) =>
  request<{ presence: Record<string, boolean> }>('POST', '/api/v1/presence/batch', token, { entity_ids: entityIds })

export const updateProfile = (token: string, data: { display_name?: string; avatar_url?: string; email?: string }) =>
  request<Entity>('PUT', '/api/v1/me', token, data)

export const regenerateEntityToken = (token: string, id: number) =>
  request<{ message: string; entity: Entity; api_key: string; disconnected: number }>(
    'POST',
    `/api/v1/entities/${id}/regenerate-token`,
    token,
  )

// Files — React Native uses { uri, name, type } pattern
export async function uploadFile(token: string, file: { uri: string; name: string; type: string }): Promise<APIResponse<{ url: string }>> {
  const form = new FormData()
  form.append('file', file as unknown as Blob)
  const res = await fetch(`${baseUrl}/api/v1/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  return parseAPIResponse<{ url: string }>(res)
}

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

export const joinViaInvite = (token: string, code: string) =>
  request('POST', `/api/v1/invite/${code}/join`, token)

// Reactions
export const toggleReaction = (token: string, msgId: number, emoji: string) =>
  request<{ message_id: number; reactions: { emoji: string; count: number; entity_ids: number[] }[] }>(
    'POST', `/api/v1/messages/${msgId}/reactions`, token, { emoji },
  )

// Message edit
export const editMessage = (token: string, msgId: number, text: string) =>
  request<Message>('PUT', `/api/v1/messages/${msgId}`, token, { layers: { summary: text } })

// Tasks
export const listTasks = (token: string, convId: number, status?: string) =>
  request<Task[]>('GET', `/api/v1/conversations/${convId}/tasks${status ? `?status=${status}` : ''}`, token)

// Memories
export const listMemories = (token: string, convId: number) =>
  request<{ memories: ConversationMemory[]; prompt: string }>('GET', `/api/v1/conversations/${convId}/memories`, token)

// Change password
export const changePassword = (token: string, oldPassword: string, newPassword: string) =>
  request('PUT', '/api/v1/me/password', token, { old_password: oldPassword, new_password: newPassword })

// Admin
export const adminGetStats = (token: string) =>
  requestQuiet<AdminStats>('GET', '/api/v1/admin/stats', token)
