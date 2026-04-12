import { buildInfo } from './build-info'
import { storage } from './storage'

const TELEMETRY_KEY = 'aim_debug_telemetry'
const MAX_EVENTS = 200

export interface DebugTelemetryEvent {
  ts: string
  type: string
  data?: Record<string, unknown>
}

export interface DebugLayoutBox {
  x: number
  y: number
  width: number
  height: number
}

export interface DebugLayoutSnapshot {
  screen?: {
    width: number
    height: number
    scale?: number
    fontScale?: number
  }
  regions?: Record<string, DebugLayoutBox>
}

function loadEvents(): DebugTelemetryEvent[] {
  try {
    const raw = storage.getString(TELEMETRY_KEY)
    return raw ? JSON.parse(raw) as DebugTelemetryEvent[] : []
  } catch {
    return []
  }
}

function saveEvents(events: DebugTelemetryEvent[]) {
  storage.set(TELEMETRY_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
}

export function logDebugEvent(type: string, data?: Record<string, unknown>) {
  const next: DebugTelemetryEvent = {
    ts: new Date().toISOString(),
    type,
    data,
  }
  saveEvents([...loadEvents(), next])
}

export function clearDebugEvents() {
  storage.delete(TELEMETRY_KEY)
}

export function getDebugEvents(): DebugTelemetryEvent[] {
  return loadEvents()
}

function buildReportHeader(title: string): string[] {
  const info = buildInfo
  return [
    `# ${title}`,
    `generated_at=${new Date().toISOString()}`,
    'app=ANI',
    `version=${info.version}`,
    `runtime_version=${info.runtimeVersion}`,
    `commit=${info.commit}`,
    `build_time=${info.buildTime}`,
  ]
}

export function buildNetworkDebugReport(context?: Record<string, unknown>): string {
  const lines = [
    ...buildReportHeader('ANI Mobile Network Debug Report'),
    '',
    '## Network Context',
    JSON.stringify(context || {}, null, 2),
    '',
    '## Recent Events',
  ]

  for (const event of loadEvents().slice(-80)) {
    lines.push(`${event.ts} ${event.type} ${JSON.stringify(event.data || {})}`)
  }

  return lines.join('\n')
}

export function buildLayoutDebugReport(layout?: DebugLayoutSnapshot): string {
  const lines = [
    ...buildReportHeader('ANI Mobile Layout Debug Report'),
    '',
    '## Layout Snapshot',
    JSON.stringify(layout || {}, null, 2),
  ]

  return lines.join('\n')
}

export function buildDebugReport(context?: Record<string, unknown>, layout?: DebugLayoutSnapshot): string {
  const lines = [
    ...buildReportHeader('ANI Mobile Debug Report'),
    '',
    '## Network Context',
    JSON.stringify(context || {}, null, 2),
    '',
    '## Layout Snapshot',
    JSON.stringify(layout || {}, null, 2),
    '',
    '## Recent Events',
  ]

  for (const event of loadEvents().slice(-80)) {
    lines.push(`${event.ts} ${event.type} ${JSON.stringify(event.data || {})}`)
  }

  return lines.join('\n')
}
