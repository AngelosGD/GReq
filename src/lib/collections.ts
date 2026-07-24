const STORAGE_KEY = 'greq-collections'

export interface Collection {
  id: string
  name: string
  nodeIds: string[]
  collapsed: boolean
}

function isValidCollection(v: unknown): v is Collection {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return typeof c.id === 'string'
    && typeof c.name === 'string'
    && Array.isArray(c.nodeIds) && c.nodeIds.every((id: unknown) => typeof id === 'string')
    && typeof c.collapsed === 'boolean'
}

export function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isValidCollection)) {
      localStorage.removeItem(STORAGE_KEY)
      return []
    }
    return parsed as Collection[]
  } catch { return [] }
}

export function saveCollections(collections: Collection[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
}

export function genCollectionId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
