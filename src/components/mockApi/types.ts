import type { KeyValuePair } from '../../types'

export type FilterMethod = 'Todas' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'UPDATE'

export interface Tab {
  id: string
  apiId: string | null
}

export interface FieldDef {
  name: string
  type: string
  value?: string
  maxLength?: number
}

export interface MockApiItem {
  id: string
  name: string
  methods: string[]
  fields: FieldDef[]
  pinned: boolean
  path: string
  port: number
  running: boolean
  serverId: string | null
  statusCode: number
  responseBody: string
  responseHeaders: KeyValuePair[]
  delayMs: number
  methodBodies: Record<string, { statusCode: number; responseBody: string; responseHeaders: KeyValuePair[] }>
  sampleData: Record<string, string>[]
}

export const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'UPDATE'] as const
export const STORAGE_KEY = 'greq-mock-apis'
export const FIELD_TYPES = ['string', 'int', 'bool', 'float'] as const

export const methodColors: Record<string, { dot: string; badge: string; text: string }> = {
  GET:    { dot: '#10b981', badge: '#d1fae5', text: '#059669' },
  POST:   { dot: '#3b82f6', badge: '#dbeafe', text: '#2563eb' },
  PUT:    { dot: '#f97316', badge: '#ffedd5', text: '#c2410c' },
  PATCH:  { dot: '#8b5cf6', badge: '#f5f3ff', text: '#6d28d9' },
  DELETE: { dot: '#ef4444', badge: '#fee2e2', text: '#dc2626' },
  UPDATE: { dot: '#f59e0b', badge: '#fef3c7', text: '#d97706' },
}

export const randomPort = () => Math.floor(Math.random() * 10000) + 30000
export const defaultBody = JSON.stringify({ id: 1, name: 'John Doe' }, null, 2)

export function genId(): string {
  try {
    const buf = new Uint8Array(16)
    crypto.getRandomValues(buf)
    buf[6] = (buf[6] & 0x0f) | 0x40
    buf[8] = (buf[8] & 0x3f) | 0x80
    const h = (i: number) => buf[i].toString(16).padStart(2, '0')
    return `${h(0)}${h(1)}${h(2)}${h(3)}-${h(4)}${h(5)}-${h(6)}${h(7)}-${h(8)}${h(9)}-${h(10)}${h(11)}${h(12)}${h(13)}${h(14)}${h(15)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}
