import type { Node, Edge } from '@xyflow/react'
import { Databases, ID, Query, Permission, Role } from 'appwrite'
import { client } from './appwrite'

const db = new Databases(client)

const DB_ID = 'greq_db'
const HISTORY_COL = 'historial'
const MOCK_COL = 'mock_apis'

/* ── Historial ── */

export interface HistoryEntry {
  id: string
  title: string
  url: string
  timestamp: number
  methodCount: number
  nodes: Node[]
  edges: Edge[]
}

export async function getHistory(userId: string): Promise<HistoryEntry[]> {
  const res = await db.listDocuments(DB_ID, HISTORY_COL, [
    Query.equal('userId', userId),
    Query.orderDesc('timestamp'),
    Query.limit(20),
  ])
  return res.documents.map((d) => {
    const raw = JSON.parse(d.data as string)
    return { ...raw, id: d.entryId }
  })
}

export async function saveHistoryEntry(userId: string, entry: HistoryEntry) {
  const existing = await db.listDocuments(DB_ID, HISTORY_COL, [
    Query.equal('userId', userId),
    Query.equal('entryId', entry.id),
    Query.limit(1),
  ])
  const payload = {
    userId,
    entryId: entry.id,
    title: entry.title || '',
    url: entry.url || '',
    timestamp: entry.timestamp,
    methodCount: entry.methodCount,
    data: JSON.stringify(entry),
  }
  if (existing.documents.length > 0) {
    await db.updateDocument(DB_ID, HISTORY_COL, existing.documents[0].$id, payload)
  } else {
    await db.createDocument(DB_ID, HISTORY_COL, ID.unique(), payload, [
      Permission.read(Role.user(userId)),
      Permission.write(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ])
  }
}

export async function deleteHistoryEntry(userId: string, entryId: string) {
  const existing = await db.listDocuments(DB_ID, HISTORY_COL, [
    Query.equal('userId', userId),
    Query.equal('entryId', entryId),
    Query.limit(1),
  ])
  if (existing.documents.length > 0) {
    await db.deleteDocument(DB_ID, HISTORY_COL, existing.documents[0].$id)
  }
}

/* ── Mock APIs ── */

export interface MockApiData {
  id: string
  name: string
  methods: string[]
  fields: { name: string; type: string }[]
  pinned: boolean
  path: string
  method: string
  statusCode: number
  responseBody: string
  responseHeaders?: { key: string; value: string }[]
  port?: number
  isRunning?: boolean
  serverId?: string | null
  delayMs?: number
  methodBodies?: Record<string, { statusCode: number; responseBody: string; responseHeaders: { key: string; value: string }[] }>
  sampleData?: Record<string, string>[]
}

export async function getMockApis(userId: string): Promise<MockApiData[]> {
  const res = await db.listDocuments(DB_ID, MOCK_COL, [
    Query.equal('userId', userId),
    Query.limit(20),
  ])
  return res.documents.map((d) => JSON.parse(d.config as string))
}

export async function saveMockApi(userId: string, api: MockApiData) {
  const existing = await db.listDocuments(DB_ID, MOCK_COL, [
    Query.equal('userId', userId),
    Query.equal('apiId', api.id),
    Query.limit(1),
  ])
  const payload = {
    userId,
    apiId: api.id,
    config: JSON.stringify(api),
  }
  if (existing.documents.length > 0) {
    await db.updateDocument(DB_ID, MOCK_COL, existing.documents[0].$id, payload)
  } else {
    await db.createDocument(DB_ID, MOCK_COL, ID.unique(), payload, [
      Permission.read(Role.user(userId)),
      Permission.write(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ])
  }
}

export async function deleteMockApi(userId: string, apiId: string) {
  const existing = await db.listDocuments(DB_ID, MOCK_COL, [
    Query.equal('userId', userId),
    Query.equal('apiId', apiId),
    Query.limit(1),
  ])
  if (existing.documents.length > 0) {
    await db.deleteDocument(DB_ID, MOCK_COL, existing.documents[0].$id)
  }
}
