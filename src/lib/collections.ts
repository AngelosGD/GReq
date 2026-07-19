const STORAGE_KEY = 'greq-collections'

export interface Collection {
  id: string
  name: string
  nodeIds: string[]
  collapsed: boolean
}

export function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveCollections(collections: Collection[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
}

export function genCollectionId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
