import { storage as mmkvStorage } from './storage'
import { AppState, Platform } from 'react-native'
import type { WSMessage } from './types'
import { WS_BASE_URL } from './constants'

type WSHandler = (msg: WSMessage) => void

const PING_INTERVAL = 25_000 // 25 seconds
const PONG_TIMEOUT = 10_000  // 10 seconds to receive pong
const SEND_QUEUE_MAX = 50

const mmkv = mmkvStorage

/** Simple UUID v4 generator (no crypto.randomUUID in React Native) */
function generateUUID(): string {
  const hex = '0123456789abcdef'
  let uuid = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-'
    } else if (i === 14) {
      uuid += '4' // version 4
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8] // variant bits
    } else {
      uuid += hex[(Math.random() * 16) | 0]
    }
  }
  return uuid
}

export class AnimpWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private handlers: Set<WSHandler> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private intentionalClose = false
  private _connected = false
  private wasConnected = false // tracks if we ever connected (for reconnect detection)

  // Client-side ping/pong
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null

  // Send queue for messages sent while disconnected
  private sendQueue: string[] = []

  // Reconnect callback
  private reconnectCallback: (() => void) | null = null

  // Connection change callbacks
  private connectionChangeHandlers: Set<(connected: boolean) => void> = new Set()
  private authFailureHandlers: Set<() => void> = new Set()

  // AppState subscription for background/foreground handling
  private appStateSubscription: { remove: () => void } | null = null

  private deviceId: string

  // Latest message ID for catch-up on reconnect
  private _sinceId: number = 0

  constructor(url: string, token: string) {
    this.url = url || WS_BASE_URL
    this.token = token
    this.deviceId = this.getOrCreateDeviceId()
  }

  /** Set the latest known message ID so reconnect can request catch-up. */
  set sinceId(id: number) { this._sinceId = id }

  private getOrCreateDeviceId(): string {
    const key = 'aim_device_id'
    let id = mmkv.getString(key) ?? null
    if (!id) {
      id = generateUUID()
      mmkv.set(key, id)
    }
    return id
  }

  get connected() { return this._connected }

  onMessage(handler: WSHandler) {
    this.handlers.add(handler)
    return () => { this.handlers.delete(handler) }
  }

  /** Register a callback that fires when the connection is restored after a drop. */
  onReconnect(callback: () => void) {
    this.reconnectCallback = callback
  }

  /** Register a callback for connection state changes. */
  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionChangeHandlers.add(handler)
    return () => { this.connectionChangeHandlers.delete(handler) }
  }

  // Fires when a connection attempt fails before WebSocket open.
  // This often indicates an auth failure (e.g. expired JWT during handshake).
  onAuthFailure(handler: () => void) {
    this.authFailureHandlers.add(handler)
    return () => { this.authFailureHandlers.delete(handler) }
  }

  connect() {
    this.intentionalClose = false
    // Listen for app state changes (foreground/background) instead of window online/offline
    this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        this.onAppForeground()
      } else if (nextState === 'background' || nextState === 'inactive') {
        this.onAppBackground()
      }
    })
    this.doConnect()
  }

  private doConnect() {
    if (this.ws) {
      try { this.ws.close() } catch { /* already closed */ }
    }
    this.stopPing()

    const deviceInfo = `${Platform.OS} ${Platform.Version}`
    // Ensure WS URL includes the /api/v1/ws path
    const baseWsUrl = this.url.endsWith('/ws') ? this.url : `${this.url}/api/v1/ws`
    let wsUrl = `${baseWsUrl}?device_id=${encodeURIComponent(this.deviceId)}&device_info=${encodeURIComponent(deviceInfo)}`
    // On reconnect, request catch-up messages since the last known ID
    if (this.wasConnected && this._sinceId > 0) {
      wsUrl += `&since_id=${this._sinceId}`
    }
    const options = this.token
      ? { headers: { Authorization: `Bearer ${this.token}` } }
      : undefined
    this.ws = options ? new WebSocket(wsUrl, undefined, options) : new WebSocket(wsUrl)
    let opened = false

    this.ws.onopen = () => {
      opened = true
      const isReconnect = this.wasConnected
      this._connected = true
      this.wasConnected = true
      this.reconnectDelay = 1000
      this.startPing()
      this.flushQueue()
      this.connectionChangeHandlers.forEach((h) => h(true))
      this.handlers.forEach((h) => h({ type: 'entity.online', data: { self: true } } as WSMessage))
      if (isReconnect && this.reconnectCallback) {
        this.reconnectCallback()
      }
    }

    this.ws.onmessage = (ev: WebSocketMessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string) as WSMessage
        if (msg.type === 'pong') {
          this.onPong()
          return
        }
        this.handlers.forEach((h) => h(msg))
      } catch { /* malformed JSON from server */ }
    }

    this.ws.onerror = (_ev: any) => {
      // handled by onclose
    }

    this.ws.onclose = (ev: any) => {
      this._connected = false
      this.stopPing()
      this.connectionChangeHandlers.forEach((h) => h(false))
      this.handlers.forEach((h) => h({ type: 'entity.offline', data: { self: true } } as WSMessage))
      if (!opened && !this.intentionalClose) {
        this.authFailureHandlers.forEach((h) => h())
      }
      if (!this.intentionalClose) this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  // --- Ping/Pong ---

  private startPing() {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
        // Start pong timeout
        this.pongTimer = setTimeout(() => {
          // No pong received -- connection is stale, force close to trigger reconnect
          this.ws?.close()
        }, PONG_TIMEOUT)
      }
    }, PING_INTERVAL)
  }

  private stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null }
  }

  private onPong() {
    if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null }
  }

  // --- App State events (replaces window online/offline) ---

  private onAppForeground() {
    if (this.intentionalClose) return
    // App came to foreground -- reconnect immediately if not connected
    if (!this._connected) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
      this.reconnectDelay = 1000
      this.doConnect()
    }
  }

  private onAppBackground() {
    // App went to background -- stop reconnect timer to save resources
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
  }

  // --- Reconnect with jitter ---

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    // Add jitter: delay * (0.8 ~ 1.2)
    const jitter = 0.8 + 0.4 * Math.random()
    const delay = this.reconnectDelay * jitter
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay)
      this.doConnect()
    }, delay)
  }

  // --- Send with queue ---

  send(data: unknown) {
    const payload = JSON.stringify(data)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload)
    } else {
      // Queue for later delivery
      if (this.sendQueue.length < SEND_QUEUE_MAX) {
        this.sendQueue.push(payload)
      }
    }
  }

  private flushQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const queued = this.sendQueue.splice(0)
    for (const payload of queued) {
      this.ws.send(payload)
    }
  }

  // --- Lifecycle ---

  disconnect() {
    this.intentionalClose = true
    this.stopPing()
    this.appStateSubscription?.remove()
    this.appStateSubscription = null
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) {
      try { this.ws.close() } catch { /* already closed */ }
      this.ws = null
    }
    this._connected = false
    this.sendQueue = []
  }

  updateToken(newToken: string) {
    this.token = newToken
  }
}
