import { storage } from './storage'
import type { Conversation, ConversationMemory, Entity, Message, Task } from './types'

const CONVERSATIONS_KEY = 'aim_cache_conversations'
const ENTITIES_KEY = 'aim_cache_entities'
const OUTBOX_KEY = 'aim_outbox_messages'
const CONTEXT_KEY_PREFIX = 'aim_context_'
const MESSAGES_KEY_PREFIX = 'aim_messages_'

export interface CachedConversationContext {
  prompt: string
  memories: ConversationMemory[]
  tasks: Task[]
  updated_at: string
}

export interface OutboxMessage {
  id: string
  temp_id: string
  conversation_id: number
  content_type?: string
  text: string
  mentions?: number[]
  reply_to?: number
  created_at: string
  attempts?: number
  last_error?: string
  last_attempt_at?: string
  sync_state?: 'queued' | 'sending' | 'failed'
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getString(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value))
}

export function cacheConversations(conversations: Conversation[]): void {
  writeJSON(CONVERSATIONS_KEY, conversations)
}

export function getCachedConversations(): Conversation[] {
  return readJSON<Conversation[]>(CONVERSATIONS_KEY, [])
}

export function cacheMessages(conversationId: number, messages: Message[]): void {
  writeJSON(`${MESSAGES_KEY_PREFIX}${conversationId}`, messages.slice(-50))
}

export function getCachedMessages(conversationId: number): Message[] {
  return readJSON<Message[]>(`${MESSAGES_KEY_PREFIX}${conversationId}`, [])
}

export function cacheEntities(entities: Entity[]): void {
  writeJSON(ENTITIES_KEY, entities)
}

export function getCachedEntities(): Entity[] {
  return readJSON<Entity[]>(ENTITIES_KEY, [])
}

export function cacheConversationContext(conversationId: number, context: CachedConversationContext): void {
  writeJSON(`${CONTEXT_KEY_PREFIX}${conversationId}`, context)
}

export function getCachedConversationContext(conversationId: number): CachedConversationContext | null {
  return readJSON<CachedConversationContext | null>(`${CONTEXT_KEY_PREFIX}${conversationId}`, null)
}

function loadOutbox(): OutboxMessage[] {
  return readJSON<OutboxMessage[]>(OUTBOX_KEY, [])
}

function saveOutbox(outbox: OutboxMessage[]): void {
  writeJSON(OUTBOX_KEY, outbox)
}

export function enqueueOutboxMessage(message: OutboxMessage): void {
  const outbox = loadOutbox()
  const existing = outbox.find((item) => item.temp_id === message.temp_id)
  if (existing) return
  saveOutbox([...outbox, { ...message, sync_state: message.sync_state || 'queued', attempts: message.attempts || 0 }])
}

export function listOutboxMessages(): OutboxMessage[] {
  return loadOutbox()
}

export function listOutboxMessagesByConversation(conversationId: number): OutboxMessage[] {
  return loadOutbox().filter((item) => item.conversation_id === conversationId)
}

export function deleteOutboxMessage(id: string): void {
  saveOutbox(loadOutbox().filter((item) => item.id !== id))
}

export function updateOutboxMessage(id: string, patch: Partial<OutboxMessage>): void {
  saveOutbox(loadOutbox().map((item) => (item.id === id ? { ...item, ...patch } : item)))
}

